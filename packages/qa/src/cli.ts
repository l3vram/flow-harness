#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { runQA } from "./qa.js";
import type { Criterion, QARequest } from "./types.js";

function main(): void {
  const target = process.argv[2];
  const requestPath = process.argv[3];
  if (target === undefined || requestPath === undefined) {
    console.error("usage: flow-qa <target> <request.json>");
    process.exit(1);
    return;
  }
  const parsed = JSON.parse(readFileSync(requestPath, "utf8")) as { platform?: string; criteria: Criterion[] };
  const req: QARequest = { target, platform: parsed.platform ?? "node", criteria: parsed.criteria };
  const report = runQA(req);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.complete ? 0 : 1);
}

main();
