import type { Event } from "../events/types.js";
import type { State } from "../domain/types.js";
import { computeWaves } from "../scheduler/waves.js";

/** A fresh, empty state — the identity element the fold starts from. */
export function emptyState(): State {
  return {
    run: "",
    objective: "",
    phase: "plan",
    gates: { A: "pending", B: "pending" },
    current_wave: 0,
    plans: [],
    waves: [],
    budget: { by_phase: {}, by_tier: {}, by_plan: {}, spawns: 0, notes: "" },
  };
}

/**
 * Fold the event log into state. This is a pure function: no clock, no randomness, no I/O.
 * Given the same events it always yields the same state, which is what makes the runtime
 * replayable and resumable. Policy (e.g. the circuit breaker) lives in the command layer,
 * not here — this projector only records what happened.
 */
export function project(events: Event[]): State {
  const s = emptyState();

  for (const e of events) {
    switch (e.type) {
      case "run.started":
        s.run = e.run;
        s.objective = e.objective;
        s.phase = "plan";
        break;

      case "task.added":
        s.plans.push({
          id: e.id,
          role: e.role,
          tier: e.tier,
          status: "pending",
          attempts: 0,
          deps: e.deps,
          worktree: "wt-" + e.id,
          review: null,
        });
        break;

      case "task.status": {
        const plan = s.plans.find((p) => p.id === e.id);
        if (plan) {
          plan.status = e.status;
          // Attempts count entries into "running", matching flow.sh's increment-on-set.
          if (e.status === "running") plan.attempts += 1;
          if (e.reason !== undefined && e.reason !== "") plan.reason = e.reason;
        }
        break;
      }

      case "wave.advanced":
        s.current_wave += 1;
        break;

      case "gate.recorded":
        s.gates[e.gate] = e.status;
        break;

      case "budget.charged": {
        const b = s.budget;
        b.by_plan[e.id] = (b.by_plan[e.id] ?? 0) + e.tokens;
        b.by_tier[e.tier] = (b.by_tier[e.tier] ?? 0) + e.tokens;
        b.by_phase[e.phase] = (b.by_phase[e.phase] ?? 0) + e.tokens;
        b.spawns += 1;
        break;
      }
    }
  }

  // Waves are always derived from the current plan graph — never persisted as truth.
  s.waves = computeWaves(s.plans).waves;
  return s;
}
