import { describe, it, expect } from 'vitest';
import converge from '../src/index.js';

describe('converge', () => {
  const minimalPlan = {
    spec: {
      objective: 'Deliver feature X',
      acceptance: ['acceptance 1', 'acceptance 2'],
      clarifications: ['clarify deployment'],
      requirements: [],
    },
    tasks: [
      {
        id: 'a',
        role: 'dev',
        tier: 'core',
        deps: [],
        instruction: 'Implement part A',
      },
      {
        id: 'b',
        role: 'dev',
        tier: 'core',
        deps: [],
        instruction: 'Implement part B',
      },
    ],
  } as const;

  it('reports incomplete when some tasks are not green', () => {
    const outcomes = { a: 'green', b: 'blocked' };
    const report = converge(minimalPlan, outcomes);

    expect(report.complete).toBe(false);
    expect(report.done).toEqual(['a']);
    expect(report.pending).toEqual(['b']);
    expect(report.acceptance).toEqual(minimalPlan.spec.acceptance);
    expect(report.clarifications).toEqual(minimalPlan.spec.clarifications);
  });

  it('reports complete when all tasks are green', () => {
    const outcomes = { a: 'green', b: 'green' };
    const report = converge(minimalPlan, outcomes);

    expect(report.complete).toBe(true);
    expect(report.pending).toEqual([]);
    expect(report.done).toEqual(['a', 'b']);
  });
});