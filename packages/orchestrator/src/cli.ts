#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Runtime, type GateId, type State } from "@flow/core";
import { Ceo } from "@flow/ceo";
import { Executor } from "@flow/executor";
import { routerFromEnv } from "@flow/llm";
import { MemoryStore, searchLessons } from "@flow/memory";
import { ContextEngine } from "@flow/context";
import { Planner } from "@flow/planner";
import { Orchestrator } from "./orchestrator.js";
import type { RunConfig, TaskSpec } from "./types.js";

async function main(): Promise<void> {
  const configPath = process.argv[2];
  if (configPath === undefined) {
    console.error("usage: flow-run <config.json>");
    process.exit(1);
    return;
  }

  let config: RunConfig;
  try {
    config = JSON.parse(readFileSync(configPath, "utf8")) as RunConfig;
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
    return;
  }

  const base = process.env.FLOW_HOME ?? ".flow";
  const dir = join(base, "runs", config.runId);
  const runtime = new Runtime(dir);
  if (runtime.started()) {
    console.error(`run '${config.runId}' already exists`);
    process.exit(1);
    return;
  }
  Runtime.init(dir, config.runId, config.objective);

  const router = routerFromEnv();

  // Resolve the task list: either hand-written in the config, or planned from the objective.
  let taskList: TaskSpec[];
  if (config.tasks !== undefined && config.tasks.length > 0) {
    taskList = config.tasks;
  } else if (config.objective) {
    const planner = new Planner(router);
    const plan = await planner.plan(config.objective, /* no repo context for v1 */ undefined);
    console.error("=== SPEC ===");
    console.error(JSON.stringify(plan.spec, null, 2));
    console.error("=== TASKS ===");
    console.error(JSON.stringify(plan.tasks, null, 2));
    if (plan.spec.clarifications.length > 0 && config.acceptPlan !== true) {
      console.error("=== CLARIFICATIONS (resolve, then re-run with acceptPlan:true) ===");
      console.error(plan.spec.clarifications.map((c) => "- " + c).join("\n"));
      process.exit(2);
      return;
    }
    if (config.acceptPlan !== true) {
      console.error('Plan ready. Review it, then re-run with "acceptPlan": true to execute.');
      process.exit(2);
      return;
    }
    taskList = plan.tasks.map((t) => ({
      id: t.id,
      role: t.role,
      tier: t.tier as TaskSpec["tier"],
      deps: t.deps,
      instruction: t.instruction,
      verify: t.verify,
    }));
  } else {
    console.error("flow-run: config needs either tasks or an objective");
    process.exit(1);
    return;
  }

  const specs = new Map<string, TaskSpec>();
  for (const spec of taskList) {
    runtime.addTask(spec.id, spec.role, spec.tier, spec.deps ?? []);
    specs.set(spec.id, spec);
  }

  // The human approves the plan (and optionally the final gate) up front by listing gates here.
  for (const gate of config.approveGates ?? []) {
    runtime.recordGate(gate as GateId, "approved");
  }

  const lessonStore = new MemoryStore(join(base, "lessons.jsonl"));
  const contextEngine = config.contextRoot ? ContextEngine.index(config.contextRoot) : null;
  const advisor = (state: State): string => {
    const parts: string[] = [];
    const lessons = searchLessons(lessonStore.all(), state.objective, 3);
    if (lessons.length > 0) parts.push("Past lessons:\n" + lessons.map((l) => "- " + l.content).join("\n"));
    if (contextEngine) {
      const bundle = contextEngine.assemble({ query: state.objective, tokenBudget: 1200 });
      if (bundle.items.length > 0) parts.push("Relevant files:\n" + bundle.items.map((i) => "- " + i.path).join("\n"));
    }
    return parts.join("\n\n");
  };
  const ceo = new Ceo(runtime, router, { advisor });
  const executor = new Executor(router, { verifyCommand: config.verifyCommand ?? [] });
  const orchestrator = new Orchestrator(runtime, ceo, executor, specs, {
    targetDir: config.targetDir,
    maxSteps: config.maxSteps,
    contextRoot: config.contextRoot,
  });

  const report = await orchestrator.run();

  // Learn from this run: record one lesson so future runs can recall what was built.
  const greenTasks = report.tasks.filter((t) => t.status === "green").map((t) => t.id);
  const roles = [...new Set(taskList.map((t) => t.role))];
  new MemoryStore(join(base, "lessons.jsonl")).add({
    id: config.runId,
    scope: "run",
    content: `${config.objective} — completed=${report.completed}; green: ${greenTasks.join(", ") || "none"}`,
    tags: roles,
    createdAt: new Date().toISOString(),
  });

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
