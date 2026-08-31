#!/usr/bin/env node
import { ContextEngine } from "./engine.js";

function main(): void {
  const query = process.argv[2];
  if (query === undefined) {
    console.error("usage: flow-context <query> [root]");
    process.exit(1);
    return;
  }

  const root = process.argv[3] ?? process.env.FLOW_CONTEXT_ROOT ?? ".";
  const budget = Number(process.env.FLOW_CONTEXT_BUDGET ?? 8000);

  const engine = ContextEngine.index(root);
  const bundle = engine.assemble({ query, tokenBudget: budget });

  if (process.env.FLOW_CONTEXT_JSON === "1") {
    console.log(JSON.stringify(bundle, null, 2));
    return;
  }

  for (const item of bundle.items) {
    console.log(`≈${item.estimatedTokens} tok  score ${item.score}  ${item.path}`);
  }
  console.log(
    `— ${bundle.items.length} files · ~${bundle.estimatedTokens}/${bundle.tokenBudget} tokens · ${engine.size} indexed`,
  );
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.stack : String(err));
  process.exit(1);
}
