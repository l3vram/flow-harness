import { join } from "node:path";
import { Runtime, type GateId } from "@flow/core";
import { Ceo } from "@flow/ceo";
import { Executor } from "@flow/executor";
import { routerFromEnv, type ModelRouter } from "@flow/llm";
import { Planner } from "@flow/planner";
import { deriveCriteria } from "@flow/verify";
import { Orchestrator } from "./orchestrator.js";
import { attachAcceptanceCriteria } from "./acceptance.js";
import type { RunConfig, RunReport, TaskSpec } from "./types.js";

export interface RunFromConfigOptions {
  router?: ModelRouter;
  baseDir?: string;
}

/**
 * Runs the autonomous loop from a RunConfig and returns the report — a reusable library entry point used by
 * the MCP `flow_run` tool. Unlike the flow-run CLI's `main`, it does NOT do git worktrees or lesson recording,
 * and over a library/MCP boundary the plan gate is a thrown "plan pending" (set acceptPlan:true) rather than a
 * process exit. It uses `opts.router` when given (so the MCP tool passes its injected router and tests stay
 * offline), otherwise `routerFromEnv()`.
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

  const ceo = new Ceo(runtime, router);
  const executor = new Executor(router, { verifyCommand: config.verifyCommand ?? [] });
  const orchestrator = new Orchestrator(runtime, ceo, executor, specs, {
    targetDir: config.targetDir,
    maxSteps: config.maxSteps,
    contextRoot: config.contextRoot,
    evidenceDir: join(dir, "evidence"),
  });
  return orchestrator.run();
}
