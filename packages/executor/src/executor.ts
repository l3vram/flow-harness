import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ModelRouter } from "@flow/llm";
import { buildExecutorMessages } from "./prompt.js";
import { parseChanges } from "./parse.js";
import { applyChanges } from "./apply.js";
import { runVerify } from "./verify.js";
import type { ExecContext, ExecResult, ExecTask, ExecutorOptions } from "./types.js";

/**
 * The keystone that turns a task into real work: asks the model for the full contents of every
 * file the task needs, applies them inside `targetDir` only, then runs the configured verify
 * command. It is the only component in the harness that writes product code.
 */
export class Executor {
  constructor(
    private readonly router: ModelRouter,
    private readonly opts: ExecutorOptions = {},
  ) {}

  async run(task: ExecTask, ctx: ExecContext): Promise<ExecResult> {
    const messages = buildExecutorMessages(task, ctx.context ?? "");

    let res: { text: string };
    try {
      res = await this.router.complete({ tier: this.opts.tier ?? "sonnet", messages });
    } catch (err) {
      // Every provider for this tier (primary + any fallback) failed. Don't abort the whole run —
      // report it as a failed verification so the task is blocked (after the repair budget) and the
      // orchestrator moves on to its siblings, instead of the run crashing.
      const message = err instanceof Error ? err.message : String(err);
      return { taskId: task.id, files: [], reason: "", verify: { ran: true, ok: false, output: `llm request failed: ${message}` } };
    }

    const { changes, reason } = parseChanges(res.text, this.opts.maxFiles ?? 50);

    let applied: string[];
    try {
      applied = applyChanges(ctx.targetDir, changes);
    } catch (err) {
      // An apply failure — most often an EDIT whose search text is absent or not unique in the
      // target file — must NOT abort the run. Surface it as a failed verification so the
      // orchestrator's repair loop feeds the error back and lets the model correct itself,
      // bounded by maxRepairAttempts (the same path a failed verify command takes). Include the
      // current content of the files the model tried to touch, so the retry can craft a matching
      // change instead of guessing blind.
      const message = err instanceof Error ? err.message : String(err);
      const shown = changes
        .map((c) => {
          const abs = resolve(ctx.targetDir, c.path);
          const current = existsSync(abs) ? readFileSync(abs, "utf8") : "(file does not exist yet)";
          return `--- ${c.path} (current content) ---\n${current}`;
        })
        .join("\n\n");
      const output = shown ? `apply failed: ${message}\n\n${shown}` : `apply failed: ${message}`;
      return { taskId: task.id, files: [], reason, verify: { ran: true, ok: false, output } };
    }

    const verify = runVerify(ctx.targetDir, ctx.verifyCommand ?? this.opts.verifyCommand ?? []);
    return { taskId: task.id, files: applied, reason, verify };
  }
}
