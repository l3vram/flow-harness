#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Runtime, type GateId, type State } from "@flow/core";
import { Ceo } from "@flow/ceo";
import { Executor } from "@flow/executor";
import { routerFromEnv } from "@flow/llm";
import { MemoryStore, searchLessons } from "@flow/memory";
import { ContextEngine } from "@flow/context";
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

  const specs = new Map<string, TaskSpec>();
  for (const spec of config.tasks) {
    runtime.addTask(spec.id, spec.role, spec.tier, spec.deps ?? []);
    specs.set(spec.id, spec);
  }

  // The human approves the plan (and optionally the final gate) up front by listing gates here.
  for (const gate of config.approveGates ?? []) {
    runtime.recordGate(gate as GateId, "approved");
  }

  const router = routerFromEnv();
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
  const roles = [...new Set(config.tasks.map((t) => t.role))];
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
