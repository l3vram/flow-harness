# Using flow via MCP (drive a feature-add on an external repo)

flow-harness can be driven by any MCP host (opencode, Cursor, Claude) as an **MCP server**, so you can point it
at a repository and have it add a feature end to end: plan -> implement -> verify (QA) -> report.

## 1. Build
```bash
npm install
npm run build   # tsc -b
```

## 2. Provider keys
Copy `.env.example` to `.env` and set a real backend per tier (e.g. Gemini for `opus`/CEO, Groq for the executor
tiers). The autonomous run needs a real LLM; see the README for the `FLOW_LLM_*` vars.

## Verify the install: `flow-mcp doctor`

Right after setting your `.env` keys and before the first `flow_run`, run the built-in
self-diagnostic:

```bash
node bin/flow-mcp.mjs doctor     # or `flow-mcp doctor` once installed
```

It reports, and exits non-zero on any failing critical check:

- **node** — Node >= 22 is required.
- **llm:haiku / llm:sonnet / llm:opus** — the provider each tier resolves to from your env. A
  `!` is the offline `fake` provider (no real backend); a real provider with a missing API key
  is a failure — set `FLOW_LLM_<TIER>_API_KEY` (or the blanket `FLOW_LLM_API_KEY`).
- **git / playwright** — optional toolchains (`!` if absent); Playwright is only needed for web QA.
- **tools** — confirms the 15 `flow_*` tools are wired into the binary.

`flow-mcp --version` and `flow-mcp --help` are also available.

## 3. Register the MCP server in your host
The server speaks the Model Context Protocol over **stdio** (no HTTP URL yet — a host connects by *launching a
command*, not by a URL). Run it **locally** (not in Docker) so the machine's toolchains (Android SDK / Gradle) are
available to the executor and the QA verify.

Use the launcher `scripts/flow-mcp.sh` — it loads your provider keys from `.env` (so they never go into the host's
config) and execs the stdio server.

**opencode — one command (no JSON to hand-edit):**
```bash
./scripts/install-opencode-mcp.sh          # merges a "flow" entry into ~/.config/opencode/opencode.json
# or a specific config:  OPENCODE_CONFIG=./opencode.json ./scripts/install-opencode-mcp.sh
```
It preserves everything else in your config and is safe to re-run. Then reload opencode and **just talk to it** —
e.g. *"use flow to add a dark-mode toggle to my app at /path/to/app; acceptPlan, verify with ./gradlew testDebugUnitTest."*
opencode calls the `flow_run` tool for you; you never paste JSON again.

**opencode — manual (equivalent):** add to `opencode.json` (replace the absolute path with yours). `timeout` matters: a `flow_run` runs a
whole autonomous loop (minutes), and opencode's MCP timeout defaults to 5000 ms — raise it:
```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "flow": {
      "type": "local",
      "command": ["/ABSOLUTE/PATH/TO/flow-harness/scripts/flow-mcp.sh"],
      "enabled": true,
      "timeout": 600000
    }
  }
}
```
(Other stdio MCP hosts use the same idea: a `command` pointing at `scripts/flow-mcp.sh`.) After registering, the
host lists 15 `flow_*` tools including `flow_run`.

**Zero-clone via npx (from GitHub).** A host that just wants to *run* the server — no clone, no `npm run build` —
can launch it straight from GitHub. `npm` clones the repo, builds it, and runs a single self-contained bundle
(`bin/flow-mcp.mjs`, the whole `@flow` graph + the MCP SDK inlined):
```json
{ "mcp": { "flow": { "type": "local",
  "command": ["npx", "-y", "github:l3vram/flow-harness", "flow-mcp"],
  "enabled": true, "timeout": 600000 } } }
```
Trade-off: the npx bin does **not** source your `.env` (that is the launcher's job), so the host/shell must supply
the `FLOW_LLM_*` provider vars itself. Use `scripts/flow-mcp.sh` when you want keys loaded from `.env`
automatically; use npx when the host already injects the env and you want nothing checked out locally. The first
launch builds (a few seconds, cached after); pin a release with `github:l3vram/flow-harness#v0.32.0`.

**Claude Code (this repo).** `.mcp.json` at the repo root already registers `flow` (via `bash scripts/flow-mcp.sh`,
which sources `.env` and runs the live `dist/` so it always reflects the newest working tree). Claude Code picks it
up on the **next session / reload** and asks you to **approve** the server before its tools are usable — approve it
once, then the `flow_*` tools are available in-session (this is how the harness dogfoods itself).

## 4. Drive a run
Call the `flow_run` tool with your objective and the target repo:
```json
{ "runId": "add-dark-mode", "targetDir": "/path/to/your/app",
  "objective": "Add a persistent dark-mode toggle to the settings screen",
  "acceptPlan": true,
  "verifyCommand": ["./gradlew", "testDebugUnitTest"] }
```
- `objective` (planner mode) needs `acceptPlan: true` to execute; without it, `flow_run` reports the plan is pending
  so you can review it first. Or pass explicit `tasks` to skip the planner.
- Acceptance criteria are auto-derived from the plan and verified by QA. You can also verify per-run with
  `verifyCommand` (any argv, run with no shell).
  > **Tip:** auto-derived criteria can be over-strict and block a *correct* result (e.g. an exact-content match).
  > For reliable runs, prefer an explicit `verifyCommand` (Gradle for Android) or explicit `tasks` whose `verify`
  > you control, rather than relying only on the derived criteria.
- The report comes back with each task's status and its QA report (evidence lands under `<FLOW_HOME>/runs/<runId>/evidence/`).

## 5. Verifying an Android app
QA runs **commands as criteria**, so use Gradle: `./gradlew testDebugUnitTest`, `./gradlew lint`,
`./gradlew assembleDebug` for a build check. These give evidence-backed verification for **logic / unit-testable**
features.

## Current limits
- **Android UI/device QA (Layer C) is not built yet** — flow does not drive an emulator/device, so *visual* UI is
  not self-verified. Logic and anything covered by Gradle unit tests is.
- `flow_run` is the lean library path: it does not create a git worktree or record lessons (the `flow-run` CLI does).
- Transport is stdio only; an HTTP transport / remote daemon is future work.
