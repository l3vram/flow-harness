import type { Message } from "@flow/llm";
import type { ExecTask } from "./types.js";

const SYSTEM_PROMPT = `You are an implementation executor. You are given a task and optionally some relevant repository
context. Accomplish the task by emitting one or more marker-delimited change blocks, and nothing
else. Two block formats are available:

To create a new file, or fully overwrite an existing one, use a FILE block with its full content:
<<<FILE relative/path/from/root>>>
the full, verbatim file content (any number of lines)
<<<END>>>

To modify part of an existing file, prefer an EDIT block instead:
<<<EDIT relative/path/from/root>>>
<<<SEARCH>>>
exact text that currently exists in the file (may span lines)
<<<REPLACE>>>
new text to put in its place
<<<END>>>

Repeat one block per change; a file may receive multiple EDIT blocks, applied in order. After the
last block you may add a single line:
<<<REASON>>> one short sentence

To modify an existing file, prefer an EDIT block; the SEARCH text must match the current file
content exactly and be unique. To create a new file, use a FILE block with its full content. Every
path MUST be relative and never contain "..". Do not wrap the output in JSON or code fences.
Every path MUST be relative to the project root and use forward slashes. Provide the FULL content
of each FILE block, not a diff.`;

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
