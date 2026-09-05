import type { Dimension, EvalInput, EvaluationReport } from "./types.js";

function pct(part: number, whole: number): number {
  return whole <= 0 ? 100 : Math.round((part / whole) * 100);
}
function clamp(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

const WEIGHTS: Record<string, number> = {
  completion: 0.25,
  verification: 0.35,
  stability: 0.15,
  efficiency: 0.1,
  safety: 0.15,
};

/**
 * Scores a run objectively from its facts — deterministic, no LLM, no clock, no network. Each dimension is
 * 0..100; the overall score is their weighted sum. A ratio over a zero denominator scores 100 (nothing to fault).
 */
export function evaluate(input: EvalInput): EvaluationReport {
  const completion = pct(input.tasksGreen, input.tasksTotal);
  const verification = pct(input.criteriaPassed, input.criteriaTotal);
  const stability = pct(input.tasksTotal - input.tasksBlocked, input.tasksTotal);
  const extraAttempts = Math.max(0, input.attempts - input.tasksTotal);
  const efficiency = clamp(100 - extraAttempts * 10);
  const safety = clamp(100 - input.criticalTickets * 25);

  const dimensions: Dimension[] = [
    { name: "completion", score: completion, detail: `${input.tasksGreen}/${input.tasksTotal} tasks green` },
    { name: "verification", score: verification, detail: `${input.criteriaPassed}/${input.criteriaTotal} acceptance criteria passed` },
    { name: "stability", score: stability, detail: `${input.tasksBlocked} blocked` },
    { name: "efficiency", score: efficiency, detail: `${extraAttempts} extra attempts` },
    { name: "safety", score: safety, detail: `${input.criticalTickets} critical tickets` },
  ];
  const score = clamp(dimensions.reduce((s, d) => s + d.score * (WEIGHTS[d.name] ?? 0), 0));
  const summary = `score ${score}/100 (completion ${completion}, verification ${verification}, stability ${stability}, efficiency ${efficiency}, safety ${safety})`;
  return { score, dimensions, summary };
}
