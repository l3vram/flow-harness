import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Runtime } from "@flow/core";
import type { Ceo } from "@flow/ceo";
import type { Executor } from "@flow/executor";
import { ContextEngine } from "@flow/context";
import { assessRisk } from "@flow/review";
import type { OrchestratorOptions, RunReport, TaskOutcome, TaskSpec } from "./types.js";

const DEFAULT_MAX_STEPS = 20;
const CONTEXT_TOKEN_BUDGET = 4000;

/**
 * The integration seam: drives a full autonomous run by wiring the CEO (decides the next move),
 * the executor (implements each ready task and verifies it), and the runtime (tracks status and
 * advances waves). Adds no new judgment logic of its own.
 */
export class Orchestrator {
  private readonly context: ContextEngine | null;

  constructor(
    private readonly runtime: Runtime,
    private readonly ceo: Ceo,
    private readonly executor: Executor,
    private readonly specs: Map<string, TaskSpec>,
    private readonly opts: OrchestratorOptions,
  ) {
    this.context = opts.contextRoot !== undefined ? ContextEngine.index(opts.contextRoot) : null;
  }

  async run(): Promise<RunReport> {
    const decisions: RunReport["decisions"] = [];
    const outcomes: Record<string, TaskOutcome> = {};
    const maxSteps = this.opts.maxSteps ?? DEFAULT_MAX_STEPS;
    let completed = false;

    for (let step = 0; step < maxSteps; step++) {
      const decision = await this.ceo.decide();
      decisions.push(decision);

      if (decision.action === "complete") {
        completed = true;
        break;
      }
      if (decision.action === "await_human") {
        break;
      }
      if (decision.action === "advance") {
        if (this.runtime.waveDone()) {
          this.runtime.advance();
          continue;
        }
        break; // CEO said advance but the wave isn't done — stop
      }

      // action === "dispatch": run every currently-ready task deterministically
      const ready = this.runtime.ready();
      if (ready.length === 0) break; // nothing to do — avoid spinning

      for (const taskId of ready) {
        const spec = this.specs.get(taskId);
        if (spec === undefined) {
          this.runtime.setStatus(taskId, "blocked", "no task spec");
          outcomes[taskId] = {
            status: "blocked",
            files: [],
            verify: { ran: false, ok: false, output: "" },
            reason: "no task spec",
          };
          continue;
        }
        this.runtime.setStatus(taskId, "running");
        const baseContext = this.contextFor(spec.instruction);
        const maxTries = (this.opts.maxRepairAttempts ?? 2) + 1;
        let result = await this.executor.run(
          { id: taskId, instruction: spec.instruction },
          { targetDir: this.opts.targetDir, context: baseContext },
        );
        let tries = 1;
        while (!result.verify.ok && tries < maxTries) {
          const repair = this.repairContext(result.files, result.verify.output);
          result = await this.executor.run(
            { id: taskId, instruction: spec.instruction },
            { targetDir: this.opts.targetDir, context: baseContext + "\n\n" + repair },
          );
          tries++;
        }
        const ok = result.verify.ok; // verify.ran === false ⇒ ok true (nothing configured)
        const risk = assessRisk({
          filesChanged: result.files,
          verifyFailed: !ok,
          touchesSecurity: result.files.some((f) => /auth|secret|password|token|crypt|exec|spawn/i.test(f)),
        });
        let status: "green" | "blocked" | "review";
        if (!ok) status = "blocked";
        else if (risk.level === "high") status = "review"; // passed verify but high risk — a human must look
        else status = "green";
        const reason = !ok ? "verify failed" : status === "review" ? "high risk — needs human review" : "";
        this.runtime.setStatus(taskId, status, reason);
        outcomes[taskId] = {
          status,
          files: result.files,
          verify: result.verify,
          reason: result.reason,
          risk,
          attempts: tries,
        };
      }
    }

    const state = this.runtime.state;
    return {
      runId: state.run,
      objective: state.objective,
      completed,
      decisions,
      outcomes,
      tasks: state.plans.map((p) => ({ id: p.id, status: p.status })),
    };
  }

  /** Assembles repo context for an instruction, or "" when no contextRoot was configured. */
  private contextFor(instruction: string): string {
    if (this.context === null) return "";
    const bundle = this.context.assemble({ query: instruction, tokenBudget: CONTEXT_TOKEN_BUDGET });
    return bundle.items.map((item) => "// " + item.path + "\n" + item.snippet).join("\n\n");
  }

  /** Builds the extra context for a repair retry: the verify failure plus current file contents. */
  private repairContext(files: string[], verifyOutput: string): string {
    const shown = files.map((f) => {
      const abs = join(this.opts.targetDir, f);
      const content = existsSync(abs) ? readFileSync(abs, "utf8") : "(missing)";
      return `--- ${f} ---\n${content}`;
    });
    return [
      "The previous attempt did not pass verification.",
      "",
      "Verify output:",
      verifyOutput,
      "",
      "Current content of the files you changed:",
      shown.join("\n\n"),
      "",
      "Fix the problem by EDITing the file(s) so verification passes.",
    ].join("\n");
  }
}
