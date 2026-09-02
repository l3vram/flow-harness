import type { ModelRouter } from '@flow/llm';
import { buildPlanMessages } from './prompt.js';
import { parsePlan } from './parse.js';
import type { Plan } from './types.js';

export interface PlannerOptions {
  tier?: string;
}

/**
 * Planner orchestrates the LLM to turn an objective into a concrete plan.
 */
export class Planner {
  private readonly router: ModelRouter;
  private readonly tier: string;

  constructor(router: ModelRouter, options?: PlannerOptions) {
    this.router = router;
    this.tier = options?.tier ?? 'opus';
  }

  async plan(objective: string, context?: string): Promise<Plan> {
    const messages = buildPlanMessages(objective, context);
    const result = await this.router.complete({ tier: this.tier, messages });
    return parsePlan(result.text);
  }
}