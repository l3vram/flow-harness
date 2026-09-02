export interface ConvergenceReport {
  /** The high‑level objective of the plan */
  objective: string;
  /** Whether all tasks are complete (green) */
  complete: boolean;
  /** IDs of tasks whose outcome is the string "green" */
  done: string[];
  /** IDs of tasks that are not yet green */
  pending: string[];
  /** Acceptance criteria taken straight from the plan spec */
  acceptance: string[];
  /** Clarifications taken straight from the plan spec */
  clarifications: string[];
  /** Human‑readable one‑line summary */
  summary: string;
}