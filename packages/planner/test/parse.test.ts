import { describe, it, expect } from 'vitest';
import { parsePlan } from '../src/index.js';

describe('parsePlan', () => {
  const validPlan = JSON.stringify({
    spec: {
      objective: 'Create a todo API',
      requirements: ['store tasks', 'retrieve tasks'],
      acceptance: ['given no tasks when creating then task is stored'],
      clarifications: ['What is the storage backend?'],
    },
    approach: 'Incremental development',
    tasks: [
      {
        id: 't1',
        role: 'backend',
        tier: 'sonnet',
        deps: [],
        instruction: 'Set up the database schema',
        verify: ['npm', 'run', 'test-db'],
      },
      {
        id: 't2',
        role: 'backend',
        tier: 'sonnet',
        deps: ['t1'],
        instruction: 'Implement create‑task endpoint',
        verify: ['npm', 'run', 'test-create'],
      },
    ],
  });

  it('parses a valid plan with clarifications and dependencies', () => {
    const plan = parsePlan(validPlan);
    expect(plan.spec.objective).toBe('Create a todo API');
    expect(plan.spec.clarifications).toEqual(['What is the storage backend?']);
    expect(plan.tasks).toHaveLength(2);
    expect(plan.tasks[1].deps).toEqual(['t1']);
  });

  it('defaults missing clarifications to empty array', () => {
    const withoutClar = JSON.stringify({
      spec: {
        objective: 'X',
        requirements: [],
        acceptance: [],
      },
      approach: '',
      tasks: [{ id: 'a', instruction: 'Do something' }],
    });
    const plan = parsePlan(withoutClar);
    expect(plan.spec.clarifications).toEqual([]);
  });

  it('throws when a task is missing its instruction', () => {
    const bad = JSON.stringify({
      spec: { objective: '' },
      approach: '',
      tasks: [{ id: 'b' }],
    });
    expect(() => parsePlan(bad)).toThrowError();
  });

  it('throws on non‑JSON input', () => {
    expect(() => parsePlan('not json')).toThrowError('planner returned no parseable JSON');
  });
});