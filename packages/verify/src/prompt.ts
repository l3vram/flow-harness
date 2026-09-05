import type { Message } from "@flow/llm";

/** Builds the LLM messages that turn free-text acceptance statements into executable QA criteria. */
export function buildDeriveMessages(acceptance: string[], context?: string): Message[] {
  const system: Message = {
    role: "system",
    content:
      "You turn free-text acceptance criteria into executable QA criteria. For EACH acceptance statement, " +
      "produce exactly one criterion with: id (kebab-case, unique), description (the acceptance restated), and " +
      "verify (an argv array — a command run with NO shell — that exits 0 if and only if the acceptance holds; " +
      "for example an argv like node -e <script>, or curl -fsS <url>, or npx vitest run <path>). " +
      "If a statement cannot be checked by a command, still emit the criterion with verify as an empty array " +
      "(it will be reported as pending). Optionally include severity (one of low, medium, high, critical) and " +
      "tags (array of strings). Reply with ONLY a JSON object with a single key criteria: an array of objects, " +
      "each with id (string), description (string), verify (array of strings), and optional severity (string) " +
      "and tags (array of strings).",
  };
  const items = acceptance.map((a, i) => `${i + 1}. ${a}`).join("\n");
  let userContent = `Acceptance criteria:\n${items}`;
  if (context !== undefined && context.trim().length > 0) {
    userContent += `\n\nContext:\n${context}`;
  }
  const user: Message = { role: "user", content: userContent };
  return [system, user];
}
