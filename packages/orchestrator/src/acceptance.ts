import type { Criterion } from "@flow/qa";
import type { TaskSpec } from "./types.js";

/**
 * Attaches derived acceptance criteria to the plan's final task, so the whole objective is QA-verified
 * (with evidence + tickets) when that task completes. Pure: returns a new task list and never mutates the
 * input. A no-op when there are no tasks or no criteria. For a multi-sink plan it targets the last-listed
 * task — good enough for the common linear plan; a per-sink split is future work.
 */
export function attachAcceptanceCriteria(tasks: TaskSpec[], criteria: Criterion[]): TaskSpec[] {
  if (tasks.length === 0 || criteria.length === 0) return tasks;
  const lastIndex = tasks.length - 1;
  return tasks.map((task, i) => (i === lastIndex ? { ...task, criteria } : task));
}
