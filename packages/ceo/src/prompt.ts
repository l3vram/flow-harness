import type { State } from "@flow/core";
import type { Message } from "@flow/llm";

const SYSTEM_PROMPT = `You are the executive (CEO) of an autonomous software-engineering run. You decide the single
next move. You never write or edit code, and you never invent state. You are given a JSON
snapshot of the run. Choose exactly one action:
- "dispatch": run the listed ready tasks now (only ids present in \`ready\`).
- "advance": move to the next wave (only when the current wave is fully green or blocked).
- "await_human": pause for a human decision (ambiguity, risk, or a needed gate).
- "complete": the objective is met and every task is green.
Reply with ONLY a JSON object, no prose, of exactly this shape:
{"action":"dispatch|advance|await_human|complete","taskIds":["..."],"reason":"one sentence","confidence":0.0}`;

/**
 * Builds the two-message prompt the CEO sends the model: a fixed system instruction plus a
 * user message carrying a JSON snapshot of the run (runtime-only fields omitted).
 */
export function buildDecisionMessages(state: State, ready: string[]): Message[] {
  const snapshot = {
    objective: state.objective,
    phase: state.phase,
    current_wave: state.current_wave,
    waves: state.waves,
    ready,
    gates: state.gates,
    tasks: state.plans.map((p) => ({
      id: p.id,
      role: p.role,
      tier: p.tier,
      status: p.status,
      deps: p.deps,
    })),
  };
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: JSON.stringify(snapshot) },
  ];
}
