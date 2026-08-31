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
    const res = await this.router.complete({ tier: this.opts.tier ?? "sonnet", messages });
    const { files, reason } = parseChanges(res.text, this.opts.maxFiles ?? 50);
    const applied = applyChanges(ctx.targetDir, files);
    const verify = runVerify(ctx.targetDir, this.opts.verifyCommand ?? []);
    return { taskId: task.id, files: applied, reason, verify };
  }
}
