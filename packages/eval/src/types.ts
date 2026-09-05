export interface EvalInput {
  tasksTotal: number;
  tasksGreen: number;
  tasksBlocked: number;
  tasksReview: number;
  /** Acceptance criteria checked by QA. */
  criteriaTotal: number;
  criteriaPassed: number;
  /** High/critical-severity QA tickets. */
  criticalTickets: number;
  /** Total executor attempts across tasks (retries inflate this). */
  attempts: number;
  tokens?: number;
}

export interface Dimension {
  name: string;
  score: number;
  detail: string;
}

export interface EvaluationReport {
  score: number;
  dimensions: Dimension[];
  summary: string;
}

export interface Comparison {
  scoreDelta: number;
  byDimension: { name: string; delta: number }[];
  verdict: "better" | "worse" | "same";
}
