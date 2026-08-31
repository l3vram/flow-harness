#!/usr/bin/env node
import { routerFromEnv } from "./config.js";

async function main(): Promise<void> {
  const prompt = process.argv.slice(2).join(" ").trim();
  if (prompt === "") {
    console.error("usage: flow-llm <prompt>");
    process.exit(1);
  }

  const router = routerFromEnv();
  const tier = process.env.FLOW_LLM_TIER ?? "sonnet";
  const result = await router.complete({ tier, messages: [{ role: "user", content: prompt }] });

  console.log(result.text);
  console.error(
    `[${result.provider}/${result.model}] in=${result.usage.inputTokens ?? "?"} out=${result.usage.outputTokens ?? "?"}`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
