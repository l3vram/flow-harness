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

## 3. Register the MCP server in your host
The server speaks the Model Context Protocol over **stdio** (no HTTP URL yet — a host connects by *launching a
command*, not by a URL). Run it **locally** (not in Docker) so the machine's toolchains (Android SDK / Gradle) are
available to the executor and the QA verify.

Use the launcher `scripts/flow-mcp.sh` — it loads your provider keys from `.env` (so they never go into the host's
config) and execs the stdio server.

**opencode** — add to `opencode.json` (replace the absolute path with yours). `timeout` matters: a `flow_run` runs a
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
