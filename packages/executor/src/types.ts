import type { Tier } from "@flow/llm";

/** One file the model wants written, with its full new content. */
export interface FileChange {
  path: string;
  content: string;
}

/** A single unit of work handed to the executor. */
export interface ExecTask {
  id: string;
  instruction: string;
}

/** The outcome of running the configured verify command. */
export interface VerifyResult {
  ran: boolean;
  ok: boolean;
  output: string;
}

/** The result of executing one task: files written, the model's stated reason, and verification. */
export interface ExecResult {
  taskId: string;
  files: string[];
  reason: string;
  verify: VerifyResult;
}

export interface ExecutorOptions {
  tier?: Tier;
  verifyCommand?: string[];
  maxFiles?: number;
}

/** Where to write files and what repository context (if any) to include in the prompt. */
export interface ExecContext {
  targetDir: string;
  context?: string;
}
