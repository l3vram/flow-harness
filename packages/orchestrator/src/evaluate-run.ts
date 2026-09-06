import { evaluate, type EvalInput, type EvaluationReport } from "@flow/eval";
import type { RunReport } from "./types.js";

/** Builds an EvalInput from a finished run and scores it deterministically via @flow/eval. */
export function evaluateRunReport(report: RunReport): EvaluationReport {
  let criteriaTotal = 0;
  let criteriaPassed = 0;
  let criticalTickets = 0;
  let attempts = 0;
  for (const outcome of Object.values(report.outcomes)) {
    attempts += outcome.attempts ?? 1;
    if (outcome.qa !== undefined) {
      for (const criterion of outcome.qa.criteria) {
        criteriaTotal += 1;
        if (criterion.status === "pass") criteriaPassed += 1;
        for (const ticket of criterion.tickets) {
          if (ticket.severity === "high" || ticket.severity === "critical") criticalTickets += 1;
        }
      }
    }
  }
  const input: EvalInput = {
    tasksTotal: report.tasks.length,
    tasksGreen: report.tasks.filter((t) => t.status === "green").length,
    tasksBlocked: report.tasks.filter((t) => t.status === "blocked").length,
    tasksReview: report.tasks.filter((t) => t.status === "review").length,
    criteriaTotal,
    criteriaPassed,
    criticalTickets,
    attempts,
  };
  return evaluate(input);
}
