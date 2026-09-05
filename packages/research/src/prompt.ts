import type { Message } from "@flow/llm";

/** Builds the LLM messages for a research query aimed at a software engineer about to implement it. */
export function buildResearchMessages(query: string, context?: string): Message[] {
  const system: Message = {
    role: "system",
    content:
      "You are a research assistant for a software engineer about to implement something. Research the " +
      "question and reply with ONLY a JSON object with three keys: summary (a short synthesis), findings " +
      "(an array of concrete, actionable points or recommendations), and sources (an array of docs/URLs or " +
      "references to verify). Prefer official docs. If you are unsure or the answer may be out of date, say so " +
      "in a finding.",
  };
  let userContent = query;
  if (context !== undefined && context.trim().length > 0) {
    userContent += "\n\nContext:\n" + context;
  }
  return [system, { role: "user", content: userContent }];
}
