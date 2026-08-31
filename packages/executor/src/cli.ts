#!/usr/bin/env node
import { routerFromEnv } from "@flow/llm";
import { ContextEngine } from "@flow/context";
import { Executor } from "./executor.js";

async function main(): Promise<void> {
  const targetDir = process.argv[2];
  const instruction = process.argv.slice(3).join(" ").trim();
  if (targetDir === undefined || instruction === "") {
    console.error("usage: flow-exec <targetDir> <instruction>");
    process.exit(1);
    return;
  }

  const router = routerFromEnv();
  const verifyCommand = (process.env.FLOW_EXEC_VERIFY ?? "")
    .split(/\s+/)
    .filter((s) => s.length > 0);

  let context: string | undefined;
  const contextRoot = process.env.FLOW_EXEC_CONTEXT_ROOT;
  if (contextRoot !== undefined) {
    const bundle = ContextEngine.index(contextRoot).assemble({
      query: instruction,
      tokenBudget: 4000,
    });
    context = bundle.items.map((item) => `${item.path}:\n${item.snippet}`).join("\n\n");
  }

  const executor = new Executor(router, { verifyCommand });
  const result = await executor.run({ id: "cli", instruction }, { targetDir, context });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
