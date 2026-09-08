import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { tools } from "./tools.js";

// Injected by scripts/bundle-mcp.mjs via esbuild `define`. Absent under tsc/vitest, so guard it.
declare const __FLOW_VERSION__: string | undefined;

export function flowVersion(): string {
  try {
    if (typeof __FLOW_VERSION__ !== "undefined" && __FLOW_VERSION__) return __FLOW_VERSION__;
  } catch {
    /* not defined under tsc/vitest */
  }
  return process.env.npm_package_version ?? "0.0.0-dev";
}

export type CheckStatus = "ok" | "warn" | "fail";
export interface Check {
  name: string;
  status: CheckStatus;
  detail: string;
}
export interface DoctorReport {
  ok: boolean;
  version: string;
  checks: Check[];
}

const TIERS = ["haiku", "sonnet", "opus"] as const;
const PROVIDERS_NEEDING_KEY = new Set([
  "openai",
  "anthropic",
  "openrouter",
  "groq",
  "mistral",
  "gemini",
  "google",
]);

function commandExists(cmd: string, args: string[]): boolean {
  try {
    const r = spawnSync(cmd, args, { stdio: "ignore" });
    return r.status === 0;
  } catch {
    return false;
  }
}

export function runDoctor(
  env: NodeJS.ProcessEnv = process.env,
  opts: { nodeVersion?: string } = {},
): DoctorReport {
  const checks: Check[] = [];

  // 1. Node version (>= 22 per package.json engines). `nodeVersion` is injectable so the
  //    fail branch is testable without actually running on an old Node.
  const nodeVersion = opts.nodeVersion ?? process.versions.node;
  const major = Number(nodeVersion.split(".")[0]);
  checks.push({
    name: "node",
    status: major >= 22 ? "ok" : "fail",
    detail: `node ${nodeVersion} (require >= 22)`,
  });

  // 2. Per-tier LLM resolution (mirrors @flow/llm routerFromEnv).
  for (const tier of TIERS) {
    const u = tier.toUpperCase();
    const kind = (env[`FLOW_LLM_${u}_PROVIDER`] || env.FLOW_LLM_PROVIDER || "fake").toLowerCase();
    const model =
      env[`FLOW_LLM_${u}_MODEL`] || env[`FLOW_LLM_MODEL_${u}`] || env.FLOW_LLM_MODEL || "(default)";
    if (kind === "fake") {
      checks.push({
        name: `llm:${tier}`,
        status: "warn",
        detail: "provider=fake (offline; no real backend)",
      });
      continue;
    }
    const hasKey = Boolean(env[`FLOW_LLM_${u}_API_KEY`] || env.FLOW_LLM_API_KEY);
    const needsKey = PROVIDERS_NEEDING_KEY.has(kind);
    checks.push({
      name: `llm:${tier}`,
      status: needsKey && !hasKey ? "fail" : "ok",
      detail:
        needsKey && !hasKey
          ? `provider=${kind} model=${model} — API key MISSING (set FLOW_LLM_${u}_API_KEY or FLOW_LLM_API_KEY)`
          : `provider=${kind} model=${model}${needsKey ? " (key set)" : ""}`,
    });
  }

  // 3. Toolchains — informational (warn, never fail).
  checks.push({
    name: "git",
    status: commandExists("git", ["--version"]) ? "ok" : "warn",
    detail: "git for @flow/git worktrees/PR",
  });
  let playwrightOk = false;
  try {
    createRequire(import.meta.url).resolve("playwright");
    playwrightOk = true;
  } catch {
    /* not installed */
  }
  checks.push({
    name: "playwright",
    status: playwrightOk ? "ok" : "warn",
    detail: "optional — web QA (Layer B) needs it",
  });

  // 4. Offline self-test: the bundle actually wired the tools.
  const names = tools.map((t) => (t as { name: string }).name);
  const wired = names.length >= 15 && ["flow_start", "flow_run", "flow_qa"].every((n) => names.includes(n));
  checks.push({
    name: "tools",
    status: wired ? "ok" : "fail",
    detail: `${names.length} flow_* tools wired`,
  });

  const ok = checks.every((c) => c.status !== "fail");
  return { ok, version: flowVersion(), checks };
}

export function formatReport(r: DoctorReport): string {
  const sym: Record<CheckStatus, string> = { ok: "✓", warn: "!", fail: "✗" };
  const lines = [`flow-mcp doctor  (v${r.version})`, ""];
  for (const c of r.checks) lines.push(`  ${sym[c.status]} ${c.name.padEnd(14)} ${c.detail}`);
  lines.push("", r.ok ? "OK - ready to run." : "FAIL - fix the failing items above before running.");
  return lines.join("\n");
}

export function doctorMain(env: NodeJS.ProcessEnv = process.env): number {
  const r = runDoctor(env);
  process.stdout.write(formatReport(r) + "\n");
  return r.ok ? 0 : 1;
}