import type { ModelRouter } from "@flow/llm";
import { buildResearchMessages } from "./prompt.js";
import { parseResearch } from "./parse.js";
import type { ResearchReport } from "./types.js";

export interface ResearchOptions {
  tier?: string;
}

/**
 * Researches a question via the LLM (judgment on the given tier, default "opus") and parses the reply
 * into a deterministic ResearchReport a consumer can drop into a prompt as context. An empty query
 * returns an empty report without an LLM call. A real web/GitHub/registry search provider can later
 * replace or augment the LLM step behind this same function.
 */
export async function research(
  router: ModelRouter,
  query: string,
  context?: string,
  opts?: ResearchOptions,
): Promise<ResearchReport> {
  if (query.trim().length === 0) {
    return { query, summary: "", findings: [], sources: [] };
  }
  const messages = buildResearchMessages(query, context);
  const res = await router.complete({ tier: opts?.tier ?? "opus", messages });
  return parseResearch(query, res.text);
}
