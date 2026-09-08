import type { Tier } from "@flow/llm";

/** One file the model wants created or fully overwritten, with its full new content. */
export interface WriteChange {
  kind: "write";
  path: string;
  content: string;
}

/** One safe search/replace edit against an existing file's exact current content. */
export interface EditChange {
  kind: "edit";
  path: string;
  search: string;
  replace: string;
}

/** A single unit of change the model wants applied to the filesystem. */
export type Change = WriteChange | EditChange;

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
  /**
   * Project-wide rules prepended to every prompt (including repair retries) as hard constraints —
   * e.g. "no Hilt/Dagger", "tests are JUnit4, not kotlin.test", "never bump dependency versions".
   * Cuts the executor repeating patterns the plan forbids. Sourced from RunConfig.conventions or an
   * AGENTS.md/CONVENTIONS.md in the target repo.
   */
  conventions?: string;
}

/** Where to write files and what repository context (if any) to include in the prompt. */
export interface ExecContext {
  targetDir: string;
  context?: string;
  verifyCommand?: string[];
}
