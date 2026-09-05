import type { ModelRouter } from "@flow/llm";
import type { Criterion } from "@flow/qa";
import { buildDeriveMessages } from "./prompt.js";
import { parseCriteria } from "./parse.js";

export interface DeriveOptions {
  tier?: string;
}

/**
 * Turns free-text acceptance criteria into executable QA `Criterion[]` via the LLM (judgment on the
 * given tier, default "opus"), then parses the response deterministically. The result is directly
 * consumable by `@flow/qa`'s `runQA`. An empty `acceptance` list returns `[]` without an LLM call.
 */
export async function deriveCriteria(
  router: ModelRouter,
  acceptance: string[],
  context?: string,
  opts?: DeriveOptions,
): Promise<Criterion[]> {
  if (acceptance.length === 0) return [];
  const messages = buildDeriveMessages(acceptance, context);
  const res = await router.complete({ tier: opts?.tier ?? "opus", messages });
  return parseCriteria(res.text);
}
