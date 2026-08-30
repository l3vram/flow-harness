import type { Plan } from "../domain/types.js";

export interface WaveResult {
  /** Layered waves: wave N holds every plan whose deps all live in earlier waves. */
  waves: string[][];
  /** Plan ids caught in a dependency cycle (empty when the graph is a DAG). */
  cycle: string[];
}

/**
 * Kahn layering. This is a faithful port of the jq logic in flow.sh:
 * repeatedly peel off the plans whose dependencies are already placed. If a round finds
 * nothing ready while plans remain, those plans form a cycle — we emit them as a final
 * wave and report the culprits so the caller can refuse to dispatch.
 */
export function computeWaves(plans: Plan[]): WaveResult {
  const byId = new Map(plans.map((p) => [p.id, p]));
  let remaining = plans.slice();
  const placed = new Set<string>();
  const waves: string[][] = [];

  while (remaining.length > 0) {
    const ready = remaining
      .filter((p) => p.deps.every((d) => placed.has(d)))
      .map((p) => p.id);

    if (ready.length === 0) {
      // Cycle: nothing is dispatchable but plans remain. Emit the remainder and stop.
      waves.push(remaining.map((p) => p.id));
      break;
    }

    waves.push(ready);
    const readySet = new Set(ready);
    for (const id of ready) placed.add(id);
    remaining = remaining.filter((p) => !readySet.has(p.id));
  }

  // A cycle surfaces as any plan that shares a wave with one of its own dependencies.
  const cycle = new Set<string>();
  for (const wave of waves) {
    const waveSet = new Set(wave);
    for (const id of wave) {
      const plan = byId.get(id);
      if (plan && plan.deps.some((d) => waveSet.has(d))) cycle.add(id);
    }
  }

  return { waves, cycle: [...cycle].sort() };
}
