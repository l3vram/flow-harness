# Plan 001: `flow-mcp doctor` — a self-diagnostic subcommand on the bundled binary

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If anything in "STOP
> conditions" occurs, stop and report — do not improvise. When done, update this
> plan's status row in `plans/v0.33-distribution/README.md`.
>
> **Drift check (run first)**: `git diff --stat cb6ab98..HEAD -- packages/mcp-server scripts/bundle-mcp.mjs`
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `cb6ab98`, 2026-09-07

## Why this matters

flow-harness is meant to run from other MCP hosts and other machines, but there is
no way to check that an install is actually functional before pointing it at a repo.
A user on a fresh machine can't tell whether their provider keys are set, whether the
toolchains QA needs (git/gradle/playwright) are present, or whether the bundled binary
even wired its tools. `flow-mcp doctor` turns "does this install work?" into one command
with a machine-readable exit code, and makes `flow-mcp --version` / `--help` work. This is
the confidence step that makes "usable outside this console" real.

## Current state

The binary is a single esbuild bundle produced from the MCP stdio entry. There is **no
argv handling** — the entry just starts the server unconditionally.

- `packages/mcp-server/src/stdio.ts` — the bundled entry point. Current full contents:
  ```ts
  #!/usr/bin/env node
  import { main } from "./server.js";

  main().catch((error) => {
    process.stderr.write(String(error instanceof Error ? error.stack ?? error.message : error) + "\n");
    process.exit(1);
  });
  ```
- `packages/mcp-server/src/index.ts` — package exports. Current full contents:
  ```ts
  export { createServer, main } from "./server.js";
  export { tools, getTool, type ToolContext, type ToolDef, type JsonSchema } from "./tools.js";
  ```
- `packages/mcp-server/src/tools.ts` — exports `tools` (an array of tool defs). There are
  exactly **15** tools, each defined with `name: "flow_..."`. The names are:
  `flow_start, flow_add_task, flow_plan, flow_ready, flow_set, flow_advance, flow_gate,
  flow_budget, flow_status, flow_report, flow_execute, flow_spec, flow_converge, flow_qa, flow_run`.
- `packages/mcp-server/src/server.ts` — `export function createServer(ctx: ToolContext): Server`
  where `ToolContext` includes `{ baseDir: string }`. Used offline in tests.
- `scripts/bundle-mcp.mjs` — bundles `packages/mcp-server/dist/stdio.js` into
  `bin/flow-mcp.mjs` via esbuild (`external: ['playwright','playwright-core']`). Current
  esbuild call has no `define`.
- **LLM env conventions** (from `packages/llm/src/config.ts` `routerFromEnv`): a tier
  `T ∈ {haiku, sonnet, opus}` resolves its provider as
  `FLOW_LLM_<T>_PROVIDER || FLOW_LLM_PROVIDER || "fake"` (lowercased). Its API key is
  `FLOW_LLM_<T>_API_KEY || FLOW_LLM_API_KEY`. Its model is
  `FLOW_LLM_<T>_MODEL || FLOW_LLM_MODEL_<T> || FLOW_LLM_MODEL || <default>`. Provider `"fake"`
  is the offline deterministic provider — valid, but not a real backend.
- **Test convention**: vitest, tests in `packages/mcp-server/test/*.test.ts`. See
  `packages/mcp-server/test/server.test.ts` for the in-memory-transport pattern and
  `import { createServer } from "../src/index.js";` (note the `.js` extension on TS imports —
  this repo uses NodeNext resolution; **match it**).

## Commands you will need

| Purpose        | Command                                             | Expected on success        |
|----------------|-----------------------------------------------------|----------------------------|
| Build          | `npm run build`                                     | exit 0 (tsc -b)            |
| Test (package) | `npx vitest run packages/mcp-server`                | all pass, incl. new tests  |
| Bundle         | `npm run bundle`                                    | prints `bundled -> .../bin/flow-mcp.mjs` |
| Run doctor     | `node bin/flow-mcp.mjs doctor`                      | prints report, exit 0 (dev env) |
| Version        | `node bin/flow-mcp.mjs --version`                   | prints a version string, exit 0 |

## Scope

**In scope** (the only files you may modify/create):
- `packages/mcp-server/src/doctor.ts` (create)
- `packages/mcp-server/src/stdio.ts` (edit — add argv routing)
- `packages/mcp-server/src/index.ts` (edit — export `runDoctor`)
- `packages/mcp-server/test/doctor.test.ts` (create)
- `scripts/bundle-mcp.mjs` (edit — inject the version via esbuild `define`)

**Out of scope** (do NOT touch):
- `package.json` at the repo root — Plan 002 owns it (version bump, publish fields).
- `packages/llm/*` — read its conventions, do not modify.
- Any other package. Do NOT add npm dependencies (use only node built-ins + existing deps).

## Git workflow

- Commit style: conventional commits (see `git log`, e.g. `feat: v0.33 ...`). Do NOT push or
  open a PR. Do NOT merge.

## Steps

### Step 1: Create `packages/mcp-server/src/doctor.ts`

Export a pure, offline function `runDoctor(env = process.env)` plus a `formatReport` and a
`doctorMain` that prints and returns an exit code. No network, no LLM calls, no new deps.

Target shape:

```ts
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { tools } from "./tools.js";

// Injected by scripts/bundle-mcp.mjs via esbuild `define`. Absent under tsc/vitest → guard it.
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
export interface Check { name: string; status: CheckStatus; detail: string; }
export interface DoctorReport { ok: boolean; version: string; checks: Check[]; }

const TIERS = ["haiku", "sonnet", "opus"] as const;
const PROVIDERS_NEEDING_KEY = new Set(["openai", "anthropic", "openrouter", "groq", "mistral", "gemini", "google"]);

function commandExists(cmd: string, args: string[]): boolean {
  try {
    const r = spawnSync(cmd, args, { stdio: "ignore" });
    return r.status === 0 || (r.status !== null && r.error === undefined);
  } catch {
    return false;
  }
}

export function runDoctor(env: NodeJS.ProcessEnv = process.env): DoctorReport {
  const checks: Check[] = [];

  // 1. Node version (>= 22 per package.json engines).
  const major = Number(process.versions.node.split(".")[0]);
  checks.push({
    name: "node",
    status: major >= 22 ? "ok" : "fail",
    detail: `node ${process.versions.node} (require >= 22)`,
  });

  // 2. Per-tier LLM resolution.
  for (const tier of TIERS) {
    const u = tier.toUpperCase();
    const kind = (env[`FLOW_LLM_${u}_PROVIDER`] || env.FLOW_LLM_PROVIDER || "fake").toLowerCase();
    const model =
      env[`FLOW_LLM_${u}_MODEL`] || env[`FLOW_LLM_MODEL_${u}`] || env.FLOW_LLM_MODEL || "(default)";
    if (kind === "fake") {
      checks.push({ name: `llm:${tier}`, status: "warn", detail: `provider=fake (offline; no real backend)` });
      continue;
    }
    const hasKey = Boolean(env[`FLOW_LLM_${u}_API_KEY`] || env.FLOW_LLM_API_KEY);
    const needsKey = PROVIDERS_NEEDING_KEY.has(kind);
    checks.push({
      name: `llm:${tier}`,
      status: needsKey && !hasKey ? "fail" : "ok",
      detail: needsKey && !hasKey
        ? `provider=${kind} model=${model} — API key MISSING (set FLOW_LLM_${u}_API_KEY or FLOW_LLM_API_KEY)`
        : `provider=${kind} model=${model}${needsKey ? " (key set)" : ""}`,
    });
  }

  // 3. Toolchains — informational (warn, never fail).
  checks.push({ name: "git", status: commandExists("git", ["--version"]) ? "ok" : "warn", detail: "git for @flow/git worktrees/PR" });
  let playwrightOk = false;
  try { createRequire(import.meta.url).resolve("playwright"); playwrightOk = true; } catch { /* not installed */ }
  checks.push({ name: "playwright", status: playwrightOk ? "ok" : "warn", detail: "optional — web QA (Layer B) needs it" });

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
  const sym = { ok: "✓", warn: "!", fail: "✗" } as const;
  const lines = [`flow-mcp doctor  (v${r.version})`, ""];
  for (const c of r.checks) lines.push(`  ${sym[c.status]} ${c.name.padEnd(14)} ${c.detail}`);
  lines.push("", r.ok ? "OK — ready to run." : "FAIL — fix the ✗ items above before running.");
  return lines.join("\n");
}

export function doctorMain(env: NodeJS.ProcessEnv = process.env): number {
  const r = runDoctor(env);
  process.stdout.write(formatReport(r) + "\n");
  return r.ok ? 0 : 1;
}
```

**Verify**: `npm run build` → exit 0.

### Step 2: Route argv in `packages/mcp-server/src/stdio.ts`

Replace the file so it dispatches on `process.argv[2]` before falling back to the server:

```ts
#!/usr/bin/env node
import { main } from "./server.js";
import { doctorMain, flowVersion } from "./doctor.js";

const arg = process.argv[2];

if (arg === "doctor") {
  process.exit(doctorMain());
} else if (arg === "--version" || arg === "-v") {
  process.stdout.write(flowVersion() + "\n");
  process.exit(0);
} else if (arg === "--help" || arg === "-h") {
  process.stdout.write(
    [
      "flow-mcp — the flow-harness MCP server (stdio)",
      "",
      "Usage:",
      "  flow-mcp              start the MCP stdio server (default)",
      "  flow-mcp doctor       run a self-diagnostic and exit (non-zero on failure)",
      "  flow-mcp --version    print the version",
      "  flow-mcp --help       show this help",
      "",
    ].join("\n"),
  );
  process.exit(0);
} else {
  main().catch((error) => {
    process.stderr.write(String(error instanceof Error ? error.stack ?? error.message : error) + "\n");
    process.exit(1);
  });
}
```

**Verify**: `npm run build` → exit 0.

### Step 3: Export `runDoctor` from the package index

Edit `packages/mcp-server/src/index.ts`, appending one export line:

```ts
export { runDoctor, formatReport, doctorMain, flowVersion, type DoctorReport, type Check } from "./doctor.js";
```

**Verify**: `npm run build` → exit 0.

### Step 4: Inject the version into the bundle

Edit `scripts/bundle-mcp.mjs`. Read the root `package.json` version and pass it to esbuild
via `define`. Add near the top (after the existing imports), then extend the `build({...})`
call with a `define` field:

```js
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
```

and inside the `build({ ... })` options add:

```js
  define: { __FLOW_VERSION__: JSON.stringify(pkg.version) },
```

(`readFileSync` and `resolve`/`root` are already imported/defined in this file.)

**Verify**: `npm run bundle` → prints `bundled -> .../bin/flow-mcp.mjs`, exit 0.

### Step 5: Tests

Create `packages/mcp-server/test/doctor.test.ts`, modeled on `server.test.ts`'s imports:

```ts
import { describe, expect, it } from "vitest";
import { runDoctor } from "../src/index.js";

describe("flow-mcp doctor", () => {
  it("empty env: tiers are fake (warn), tools wired, overall ok", () => {
    const r = runDoctor({});
    expect(r.ok).toBe(true); // warns don't fail
    expect(r.checks.find((c) => c.name === "llm:opus")?.status).toBe("warn");
    expect(r.checks.find((c) => c.name === "tools")?.status).toBe("ok");
    expect(r.checks.find((c) => c.name === "node")?.status).toBe("ok");
  });

  it("real provider without a key fails that tier and the overall report", () => {
    const r = runDoctor({ FLOW_LLM_OPUS_PROVIDER: "anthropic" });
    expect(r.checks.find((c) => c.name === "llm:opus")?.status).toBe("fail");
    expect(r.ok).toBe(false);
  });

  it("real provider with a key passes that tier", () => {
    const r = runDoctor({ FLOW_LLM_OPUS_PROVIDER: "anthropic", FLOW_LLM_OPUS_API_KEY: "x" });
    expect(r.checks.find((c) => c.name === "llm:opus")?.status).toBe("ok");
  });

  it("blanket FLOW_LLM_API_KEY satisfies a tier with a real provider", () => {
    const r = runDoctor({ FLOW_LLM_PROVIDER: "groq", FLOW_LLM_API_KEY: "x" });
    expect(r.checks.find((c) => c.name === "llm:haiku")?.status).toBe("ok");
  });
});
```

**Verify**: `npx vitest run packages/mcp-server` → all pass, including the 4 new tests.

## Test plan

- New file `packages/mcp-server/test/doctor.test.ts` with the 4 cases above:
  offline/fake → ok; real provider missing key → fail; real provider + key → ok;
  blanket key path → ok. Modeled structurally on `packages/mcp-server/test/server.test.ts`.
- Full verification: `npm run build && npx vitest run` → all pass (was 185; now ≥189).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run build` exits 0
- [ ] `npx vitest run packages/mcp-server` passes, with the 4 new doctor tests
- [ ] `npm run bundle` regenerates `bin/flow-mcp.mjs` (exit 0)
- [ ] `node bin/flow-mcp.mjs doctor` prints a report and exits 0 in this dev env
      (fake tiers show `!`, none show `✗`)
- [ ] `node bin/flow-mcp.mjs --version` prints a version string and exits 0
- [ ] `node bin/flow-mcp.mjs --help` prints usage and exits 0
- [ ] Only in-scope files changed (`git status` shows nothing outside the Scope list,
      except the regenerated `bin/flow-mcp.mjs`)
- [ ] Status row updated in `plans/v0.33-distribution/README.md`

## STOP conditions

Stop and report (do not improvise) if:

- `packages/mcp-server/src/stdio.ts` or `index.ts` does not match the excerpts above
  (the code drifted since this plan was written).
- The build fails with a NodeNext/ESM resolution error you cannot fix by adding the `.js`
  extension to a relative import.
- `node bin/flow-mcp.mjs doctor` exits non-zero in a clean dev checkout (that would mean a
  real check regressed, not a plan issue).
- Making a check pass would require adding an npm dependency — it must not.

## Maintenance notes

- The tool self-test asserts `>= 15` tools; when tools are added it stays valid. If a tool is
  ever renamed away from the three sampled names (`flow_start`/`flow_run`/`flow_qa`), update the
  sample list in `doctor.ts` and the test.
- `PROVIDERS_NEEDING_KEY` is a denylist-of-keyless heuristic; a new keyless local provider
  (e.g. `ollama`, `lmstudio`, `vllm`) is correctly treated as needing no key by being absent
  from the set — keep it that way.
- Deferred out of scope: a live provider ping (a real `complete()` call) — doctor stays offline
  by design so it never spends tokens or needs network.
