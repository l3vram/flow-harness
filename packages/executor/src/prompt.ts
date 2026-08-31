import type { Message } from "@flow/llm";
import type { ExecTask } from "./types.js";

const SYSTEM_PROMPT = `You are an implementation executor. You are given a task and optionally some relevant repository
context. Produce the complete new contents of every file needed to accomplish the task. Reply
with ONLY a JSON object, no prose, of exactly this shape:
{"files":[{"path":"relative/path/from/root","content":"full file contents"}],"reason":"one sentence"}
Every path MUST be relative to the project root, use forward slashes, and never contain "..".
Provide the FULL content of each file you write, not a diff.`;

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
