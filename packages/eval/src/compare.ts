import type { Comparison, EvaluationReport } from "./types.js";

/** Diffs two evaluation reports (b relative to a) across the overall score and each dimension. */
export function compare(a: EvaluationReport, b: EvaluationReport): Comparison {
  const scoreDelta = b.score - a.score;
  const byDimension = b.dimensions.map((db) => {
    const da = a.dimensions.find((x) => x.name === db.name);
    return { name: db.name, delta: db.score - (da?.score ?? 0) };
  });
  const verdict: Comparison["verdict"] = scoreDelta > 0 ? "better" : scoreDelta < 0 ? "worse" : "same";
  return { scoreDelta, byDimension, verdict };
}
