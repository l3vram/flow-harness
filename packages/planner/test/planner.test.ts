import { FakeProvider, ModelRouter } from '@flow/llm';
import { Planner } from '../src/index.js';
import { describe, it, expect } from 'vitest';

describe('Planner', () => {
  const planJson = JSON.stringify({
    spec: { objective: 'Build a todo API', requirements: [], acceptance: [] },
    approach: '',
    tasks: [{ id: 't1', instruction: 'Init project' }],
  });

  // A minimal router stub that satisfies the ModelRouter interface.
  const router = {
    async complete(_tier: string, _messages: any) {
      return { text: planJson };
    },
  } as unknown as ModelRouter;

  it('produces a plan from the LLM response', async () => {
    const planner = new Planner(router);
    const plan = await planner.plan('Build a todo API');
    expect(plan.spec.objective).toBe('Build a todo API');
    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0].instruction).toBe('Init project');
  });
});