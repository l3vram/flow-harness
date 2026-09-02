import type { Plan } from '@flow/planner';
import type { ConvergenceReport } from './types.js';

/**
 * Produce a deterministic convergence report for a given plan and the
 * outcomes of its tasks.
 *
 * @param plan     The plan to analyse.
 * @param outcomes A record mapping task IDs to their outcome strings.
 * @returns        A fully deterministic {@link ConvergenceReport}.
 */
export function converge(plan: Plan, outcomes: Record<string, string>): ConvergenceReport {
  const taskIds = plan.tasks.map(t => t.id);

  const done = taskIds.filter(id => outcomes[id] === 'green');
  const pending = taskIds.filter(id => !done.includes(id));

  const complete = taskIds.length > 0 && pending.length === 0;

  const acceptance = plan.spec.acceptance;
  const clarifications = plan.spec.clarifications;
  const objective = plan.spec.objective;

  const summary = `${done.length}/${taskIds.length} green, ${
    complete ? 'complete' : `${pending.length} pending`
  }, ${clarifications.length} open clarifications`;

  return {
    objective,
    complete,
    done,
    pending,
    acceptance,
    clarifications,
    summary,
  };
}