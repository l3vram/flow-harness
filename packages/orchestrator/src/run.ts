import { join } from "node:path";
import { Runtime, type GateId } from "@flow/core";
import { Ceo } from "@flow/ceo";
import { Executor } from "@flow/executor";
import { routerFromEnv, type ModelRouter } from "@flow/llm";
import { Planner } from "@flow/planner";
import { deriveCriteria } from "@flow/verify";
import { isGitRepo, createWorktree, commitAll } from "@flow/git";
import { Orchestrator } from "./orchestrator.js";
import { attachAcceptanceCriteria } from "./acceptance.js";
import type { RunConfig, RunReport, TaskSpec } from "./types.js";

export interface RunFromConfigOptions {
  router?: ModelRouter;
  baseDir?: string;
}

/**
 * Runs the autonomous loop from a RunConfig and returns the report — a reusable library entry point used by
 * the MCP `flow_run` tool. Over a library/MCP boundary the plan gate is a thrown "plan pending" (set
 * acceptPlan:true) rather than a process exit. It uses `opts.router` when given (so the MCP tool passes its
 * injected router and tests stay offline), otherwise `routerFromEnv()`.
 *
 * With `config.worktree === true` and a git targetDir, the run is isolated on a `flow/<runId>` branch/worktree
 * (created under `<baseDir>/worktrees/<runId>`) instead of the target's working tree; the branch is committed
 * for review and surfaced on the report as `branch`/`worktreeDir`. Off by default. (Lesson recording still
 * lives only in the flow-run CLI.)
 */
export async function runFromConfig(config: RunConfig, opts: RunFromConfigOptions = {}): Promise<RunReport> {
  const baseDir = opts.baseDir ?? process.env.FLOW_HOME ?? ".flow";
  const dir = join(baseDir, "runs", config.runId);
  const runtime = new Runtime(dir);
  if (runtime.started()) {
    throw new Error(`run '${config.runId}' already exists`);
  }
  Runtime.init(dir, config.runId, config.objective);
  const router = opts.router ?? routerFromEnv();

  let taskList: TaskSpec[];
  if (config.tasks !== undefined && config.tasks.length > 0) {
    taskList = config.tasks;
  } else if (config.objective) {
    const plan = await new Planner(router).plan(config.objective);
    if (config.acceptPlan !== true) {
      throw new Error("plan pending: review the spec/tasks, then set acceptPlan:true to execute");
    }
    taskList = plan.tasks.map((t) => ({
      id: t.id,
      role: t.role,
      tier: t.tier as TaskSpec["tier"],
      deps: t.deps,
      instruction: t.instruction,
      verify: t.verify,
    }));
    if (config.deriveCriteria !== false && plan.spec.acceptance.length > 0) {
      taskList = attachAcceptanceCriteria(taskList, await deriveCriteria(router, plan.spec.acceptance));
    }
  } else {
    throw new Error("flow-run: config needs either tasks or an objective");
  }

  const specs = new Map<string, TaskSpec>();
  for (const spec of taskList) {
    runtime.addTask(spec.id, spec.role, spec.tier, spec.deps ?? []);
    specs.set(spec.id, spec);
  }
  for (const gate of config.approveGates ?? []) {
    runtime.recordGate(gate as GateId, "approved");
  }

  // Optionally isolate the run on a git worktree/branch of targetDir, so it never touches the target's
  // working tree — the caller reviews the branch as a PR. Available over MCP (flow_run), unlike the CLI-only
  // path before v0.34. Off by default (writes into targetDir directly).
  let effectiveTargetDir = config.targetDir;
  let worktreeDir: string | undefined;
  let branch: string | undefined;
  if (config.worktree === true && isGitRepo(config.targetDir)) {
    branch = `flow/${config.runId}`;
    worktreeDir = join(baseDir, "worktrees", config.runId);
    createWorktree(config.targetDir, worktreeDir, branch);
    effectiveTargetDir = worktreeDir;
  }

  const ceo = new Ceo(runtime, router);
  const executor = new Executor(router, { verifyCommand: config.verifyCommand ?? [] });
  const orchestrator = new Orchestrator(runtime, ceo, executor, specs, {
    targetDir: effectiveTargetDir,
    maxSteps: config.maxSteps,
    contextRoot: config.contextRoot,
    evidenceDir: join(dir, "evidence"),
  });
  const report = await orchestrator.run();

  // If isolated, commit the changes on the run's branch for review (a PR gate) and surface the branch/worktree.
  if (worktreeDir !== undefined && branch !== undefined) {
    commitAll(worktreeDir, `flow-run: ${config.objective || config.runId}`);
    report.branch = branch;
    report.worktreeDir = worktreeDir;
  }
  return report;
}