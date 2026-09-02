import type { Message } from '@flow/llm';

export function buildPlanMessages(objective: string, context?: string): Message[] {
  const system: Message = {
    role: 'system',
    content:
      'You are a Spec-Driven Development planner. FIRST, produce a spec with clear, testable requirements and Given/When/Then acceptance criteria, and record any ambiguity as a clarification item. THEN, break the work into an ordered list of small, independently testable tasks with dependencies (setup tasks before foundational tasks before feature tasks), each with a verify command when possible. Reply with ONLY a JSON object with keys: spec (object with objective:string, requirements:string[], acceptance:string[], clarifications:string[]), approach:string, tasks:array of objects each with id:string, role:string, tier:string, deps:string[], instruction:string, verify:string[].',
  };

  let userContent = objective;
  if (context && context.trim().length > 0) {
    userContent += `\n${context}`;
  }

  const user: Message = {
    role: 'user',
    content: userContent,
  };

  return [system, user];
}