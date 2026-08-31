import type { Message } from "@flow/llm";
import type { ExecTask } from "./types.js";

const SYSTEM_PROMPT = `You are an implementation executor. You are given a task and optionally some relevant repository
context. Produce the complete new contents of every file needed to accomplish the task. Output
each file as a marker-delimited block, and nothing else:
<<<FILE relative/path/from/root>>>
the full, verbatim file content (any number of lines)
<<<END>>>
Repeat one block per file. After the last block you may add a single line:
<<<REASON>>> one short sentence
Every path MUST be relative to the project root, use forward slashes, and never contain "..".
Do not wrap the output in JSON or code fences. Provide the FULL content of each file, not a diff.`;

/**
 * Builds the two-message prompt sent to the model: a fixed system instruction plus a user
 * message carrying the task instruction and, when present, relevant repository context.
 */
export function buildExecutorMessages(task: ExecTask, context: string): Message[] {
  let userContent = `Task: ${task.instruction}`;
  if (context !== "") {
    userContent += `\n\nRelevant context:\n${context}`;
  }
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ];
}
