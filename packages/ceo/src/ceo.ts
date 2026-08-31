import type { Runtime } from "@flow/core";
import type { ModelRouter, Tier } from "@flow/llm";
import { buildDecisionMessages } from "./prompt.js";
import { parseDecision } from "./parse.js";
import type { CeoDecision } from "./types.js";

export interface CeoOptions {
  tier?: Tier;
  autoApply?: boolean;
}

/**
 * The thin executive loop. It observes a run's state, asks the model for the single next move,
 * and applies only one DAG-safe action automatically (advancing a finished wave) — everything
 * else, including any dispatch, is handed back to the caller. It never writes or edits code and
 * never mutates state except through `Runtime`'s typed methods.
 */
export class Ceo {
  constructor(
    private readonly runtime: Runtime,
    private readonly router: ModelRouter,
    private readonly opts: CeoOptions = {},
  ) {}

  /** Asks the model for the next move given the current run state. Does not apply anything. */
  async decide(): Promise<CeoDecision> {
    const state = this.runtime.state;
    const ready = this.runtime.ready();
    const messages = buildDecisionMessages(state, ready);
    const res = await this.router.complete({ tier: this.opts.tier ?? "opus", messages });
    return parseDecision(res.text);
  }

  /**
   * Decides, then applies at most one thing — and only when `autoApply` is set: an "advance"
   * decision is auto-applied via `runtime.advance()` when the current wave is actually done.
   * Model-reported `confidence` is never used to gate this; it is recorded for humans only.
   * Every other outcome (dispatch, await_human, complete, or an advance whose wave is not yet
   * done) applies nothing and is simply handed back as a signal to the caller.
   */
  async step(): Promise<{ decision: CeoDecision; applied: boolean }> {
    const decision = await this.decide();
    let applied = false;
    if (this.opts.autoApply === true && decision.action === "advance" && this.runtime.waveDone()) {
      this.runtime.advance();
      applied = true;
    }
    return { decision, applied };
  }

  /**
   * Runs up to `maxSteps` decision cycles, stopping early on a terminal or blocking signal:
   * "complete", "await_human", a "dispatch" (no executor is wired yet — the ids are handed to
   * the fleet/human), or an "advance" that did not apply (the wave was not actually done).
   */
  async run(maxSteps = 10): Promise<CeoDecision[]> {
    const decisions: CeoDecision[] = [];
    for (let i = 0; i < maxSteps; i++) {
      const { decision, applied } = await this.step();
      decisions.push(decision);
      if (decision.action === "complete" || decision.action === "await_human") break;
      if (decision.action === "dispatch") break;
      if (decision.action === "advance" && !applied) break;
    }
    return decisions;
  }
}
