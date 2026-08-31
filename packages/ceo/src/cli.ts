#!/usr/bin/env node
import { join } from "node:path";
import { Runtime } from "@flow/core";
import { routerFromEnv } from "@flow/llm";
import { Ceo } from "./ceo.js";

async function main(): Promise<void> {
  const runId = process.argv[2];
  if (runId === undefined) {
    console.error("usage: flow-ceo <runId>");
    process.exit(1);
    return;
  }

  const base = process.env.FLOW_HOME ?? ".flow";
  const dir = join(base, "runs", runId);
  const runtime = new Runtime(dir);
  if (!runtime.started()) {
    console.error(`run not found: ${runId}`);
    process.exit(1);
    return;
  }

  const router = routerFromEnv();
  const ceo = new Ceo(runtime, router, { autoApply: process.env.FLOW_CEO_AUTO_APPLY === "1" });
  const decisions = await ceo.run(Number(process.env.FLOW_CEO_MAX_STEPS ?? 10));
  for (const decision of decisions) {
    console.log(JSON.stringify(decision));
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
