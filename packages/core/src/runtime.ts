import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GateId, State, Status, Tier } from "./domain/types.js";
import { EventStore } from "./events/store.js";
import type { Event } from "./events/types.js";
import { project } from "./projection/project.js";
import { computeWaves, type WaveResult } from "./scheduler/waves.js";

const CIRCUIT_BREAKER_LIMIT = 3;

const now = (): string => new Date().toISOString();

export interface SetStatusResult {
  /** The plan's status after any policy (circuit breaker) has been applied. */
  status: Status;
  /** Attempt count after this transition. */
  attempts: number;
  /** True when the circuit breaker forced the plan to "blocked". */
  breaker: boolean;
}

/**
 * The deterministic runtime. Every mutation appends to the event log and then rewrites the
 * state.json projection as a convenience cache. Because state is a pure fold of the log,
 * deleting state.json and constructing a new Runtime over the same directory reproduces the
 * exact same state — this is what gives us resume-after-restart and event replay for free.
 *
 * No LLM is involved anywhere in this class. Control flow is arithmetic.
 */
export class Runtime {
  private readonly store: EventStore;
  private readonly statePath: string;

  constructor(private readonly dir: string) {
    this.store = new EventStore(join(dir, "events.jsonl"));
    this.statePath = join(dir, "state.json");
  }

  /** Whether a run has been initialised in this directory. */
  started(): boolean {
    return this.store.exists();
  }

  /** The current projected state, recomputed from the log. */
  get state(): State {
    return project(this.store.read());
  }

  private commit(...events: Event[]): void {
    for (const e of events) this.store.append(e);
    this.persist();
  }

  /** Write the projection cache. Safe to delete at any time; it will be rebuilt. */
  private persist(): void {
    mkdirSync(this.dir, { recursive: true });
    writeFileSync(this.statePath, JSON.stringify(this.state, null, 2) + "\n", "utf8");
  }

  static init(dir: string, run: string, objective = ""): Runtime {
    const rt = new Runtime(dir);
    rt.commit({ type: "run.started", ts: now(), run, objective });
    return rt;
  }

  addTask(id: string, role: string, tier: Tier, deps: string[] = []): void {
    this.commit({ type: "task.added", ts: now(), id, role, tier, deps });
  }

  /**
   * Transition a plan. Enforces the circuit breaker: once a plan has been run
   * CIRCUIT_BREAKER_LIMIT times without going green, it is forced to "blocked" so blind
   * retries stop burning budget. The breaker is expressed as a second recorded event, so
   * the projection stays a dumb fold and the block is auditable in the log.
   */
  setStatus(id: string, status: Status, reason = ""): SetStatusResult {
    this.store.append({ type: "task.status", ts: now(), id, status, reason });

    let state = this.state;
    const plan = state.plans.find((p) => p.id === id);
    const attempts = plan?.attempts ?? 0;
    let breaker = false;

    if (attempts >= CIRCUIT_BREAKER_LIMIT && status !== "green") {
      const existing = plan?.reason ?? "";
      const combined = existing + " [circuit breaker: 3 attempts]";
      this.store.append({ type: "task.status", ts: now(), id, status: "blocked", reason: combined });
      breaker = true;
      state = this.state;
    }

    this.persist();
    const finalPlan = state.plans.find((p) => p.id === id);
    return { status: finalPlan?.status ?? status, attempts, breaker };
  }

  /** Plan ids dispatchable right now: in the current wave, pending, all deps green. */
  ready(): string[] {
    const s = this.state;
    const wave = s.waves[s.current_wave] ?? [];
    const green = new Set(s.plans.filter((p) => p.status === "green").map((p) => p.id));
    return s.plans
      .filter((p) => wave.includes(p.id))
      .filter((p) => p.status === "pending")
      .filter((p) => p.deps.every((d) => green.has(d)))
      .map((p) => p.id);
  }

  /** True when every member of the current wave is green or blocked. */
  waveDone(): boolean {
    const s = this.state;
    const wave = s.waves[s.current_wave] ?? [];
    const members = s.plans.filter((p) => wave.includes(p.id));
    return members.every((p) => p.status === "green" || p.status === "blocked");
  }

  /** Advance to the next wave. The barrier: refuses unless the current wave is done. */
  advance(): { wave: number; total: number } {
    if (!this.waveDone()) {
      throw new Error("barrier: current wave not complete — not advancing");
    }
    this.commit({ type: "wave.advanced", ts: now() });
    const s = this.state;
    return { wave: s.current_wave, total: s.waves.length };
  }

  recordGate(gate: GateId, status: string): void {
    this.commit({ type: "gate.recorded", ts: now(), gate, status });
  }

  chargeBudget(id: string, tokens: number, tier: Tier, phase: string): void {
    this.commit({ type: "budget.charged", ts: now(), id, tokens, tier, phase });
  }

  /** Recompute wave layering + cycle detection from the current plan graph. */
  waves(): WaveResult {
    return computeWaves(this.state.plans);
  }
}
