import type { Plan, Spec, PlannedTask } from './types.js';

/**
 * Extracts the first JSON object from the given text and parses it.
 * Throws an error if no parsable JSON is found.
 */
export function parsePlan(text: string): Plan {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('planner returned no parseable JSON');
  }
  const jsonStr = text.slice(start, end + 1);
  let raw: any;
  try {
    raw = JSON.parse(jsonStr);
  } catch {
    throw new Error('planner returned no parseable JSON');
  }

  // Normalise spec
  const rawSpec: any = raw.spec ?? {};
  const spec: Spec = {
    objective: typeof rawSpec.objective === 'string' ? rawSpec.objective : '',
    requirements: Array.isArray(rawSpec.requirements)
      ? rawSpec.requirements.filter((v: any) => typeof v === 'string')
      : [],
    acceptance: Array.isArray(rawSpec.acceptance)
      ? rawSpec.acceptance.filter((v: any) => typeof v === 'string')
      : [],
    clarifications: Array.isArray(rawSpec.clarifications)
      ? rawSpec.clarifications.filter((v: any) => typeof v === 'string')
      : [],
  };

  // Normalise approach
  const approach: string = typeof raw.approach === 'string' ? raw.approach : '';

  // Normalise tasks
  if (!Array.isArray(raw.tasks)) {
    throw new Error('planner returned no parseable JSON');
  }

  const tasks: PlannedTask[] = raw.tasks.map((t: any, idx: number) => {
    if (typeof t.id !== 'string' || t.id.trim() === '') {
      throw new Error(`task at index ${idx} is missing a non‑empty string id`);
    }
    if (typeof t.instruction !== 'string' || t.instruction.trim() === '') {
      throw new Error(`task ${t.id} is missing a non‑empty instruction`);
    }

    const task: PlannedTask = {
      id: t.id,
      role: typeof t.role === 'string' ? t.role : 'backend',
      tier: typeof t.tier === 'string' ? t.tier : 'sonnet',
      deps: Array.isArray(t.deps)
        ? t.deps.filter((v: any) => typeof v === 'string')
        : [],
      instruction: t.instruction,
    };

    if (Array.isArray(t.verify) && t.verify.every((v: any) => typeof v === 'string')) {
      task.verify = t.verify;
    }

    return task;
  });

  return { spec, approach, tasks };
}