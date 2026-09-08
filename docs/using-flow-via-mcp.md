# Using flow via MCP — add a feature to your app and let it verify the work

flow-harness runs as an **MCP server**, so any MCP host (opencode, Cursor, Claude Code) can point it
at one of your repos and have it add a feature end to end:

> **plan → write the code → run your tests (QA) → collect evidence → report** — on an isolated branch.

You talk to your host in plain language ("use flow to add X to my app"); the host calls the `flow_run`
tool for you. You never hand-write JSON.

---

## What you need (once)

- **Node ≥ 22** and **git** on your machine.
- **flow-harness** checked out somewhere (call that path `FLOW_DIR`).
- **Provider keys**: copy `.env.example` to `.env` in `FLOW_DIR` and set a real LLM backend per tier
  (e.g. Gemini for the `opus`/planner tier, Groq for the `sonnet`/`haiku` executor tiers). The keys stay
  in that `.env` — they never go into your host's config. See the README for the `FLOW_LLM_*` variables.

---

## 1. Install flow into opencode

**One command** (from `FLOW_DIR`):

```bash
npm install && npm run build          # build the server once
./scripts/install-opencode-mcp.sh     # register "flow" in ~/.config/opencode/opencode.json
```

The script only adds a `flow` entry (it keeps everything else in your config) and is safe to re-run.
Prefer it scoped to one project? Run it from that project with `OPENCODE_CONFIG=./opencode.json ./scripts/install-opencode-mcp.sh`.

**Or ask opencode to install it for you** — paste this into opencode:

> Install the **flow** MCP server. Run exactly this and show me the output:
> ```bash
> cd FLOW_DIR && npm install && npm run build && ./scripts/install-opencode-mcp.sh && ( set -a; . ./.env; set +a; node packages/mcp-server/dist/stdio.js doctor )
> ```
> If the doctor ends with exit 0 and shows `✓ tools  15 flow_* tools wired`, tell me it's installed and
> remind me to reload opencode. If anything fails, show me the error.

**Then reload/restart opencode.** On reconnect it lists the 15 `flow_*` tools (including `flow_run`) and
receives the server's built-in usage instructions — that's what lets you drive it in plain language.

---

## 2. Check it works: `flow-mcp doctor`

A one-command health check. Run it after setting your keys, before your first run:

```bash
node bin/flow-mcp.mjs doctor      # or `flow-mcp doctor` once installed
```

```
flow-mcp doctor  (v0.34.0)

  ✓ node           node 22.x (require >= 22)
  ✓ llm:haiku      provider=groq model=... (key set)
  ✓ llm:sonnet     provider=groq model=... (key set)
  ✓ llm:opus       provider=gemini model=... (key set)
  ✓ git            git for @flow/git worktrees/PR
  ! playwright     optional — web QA (Layer B) needs it
  ✓ tools          15 flow_* tools wired

OK - ready to run.
```

- **node** — Node ≥ 22 is required (`✗` if older).
- **llm:haiku / sonnet / opus** — the provider each tier resolves to. `!` = the offline `fake` provider
  (no real backend); a real provider with a **missing key is `✗`** — set `FLOW_LLM_<TIER>_API_KEY` (or the
  blanket `FLOW_LLM_API_KEY`).
- **git / playwright** — optional (`!` if absent); Playwright is only for web QA (Layer B).
- **tools** — confirms the 15 `flow_*` tools are wired in.

Exit `0` = ready (warnings are fine); exit `1` = fix the `✗` first. `flow-mcp --version` and
`flow-mcp --help` also work.

---

## 3. Use it — just talk to opencode

Because the server ships its own usage instructions, you describe the job in plain language and opencode
fills the tool parameters for you. For example:

> Use **flow** to add a persistent dark-mode toggle to the settings screen of my app at
> `/Users/me/apps/myapp`, on an **isolated branch**, and verify with Gradle
> (`./gradlew :app:testDebugUnitTest`). **Show me the plan first.**

opencode calls `flow_run` with: your absolute `targetDir`, `worktree: true` (isolation), your
`verifyCommand`, `deriveCriteria: false`, and — because you said "show me the plan first" — it runs
**without** `acceptPlan`, so flow returns the plan for you to review. When you approve, opencode re-runs
with `acceptPlan: true` and it executes.

**Why "verify with Gradle" and not just "make it work":** flow proves work with **evidence** (your test
command's real result), never the model's say-so. Give it a real command and the run only goes green when
that command passes.

---

## 4. Review the result

With `worktree: true` (recommended), flow **never touches your app's working tree**. It:

- creates a branch **`flow/<runId>`** in your app repo and works there (the worktree lives under
  `FLOW_DIR/.flow/worktrees/<runId>`),
- commits its changes on that branch,
- returns **`branch`** and **`worktreeDir`** in the report.

Review it like any branch and merge if you like it:

```bash
cd /Users/me/apps/myapp
git log flow/<runId> -p        # see exactly what it changed
git checkout flow/<runId>      # try it out
```

The QA **evidence** (each test's stdout/stderr/exit) lands under
`FLOW_DIR/.flow/runs/<runId>/evidence/<taskId>/`.

---

## 5. Android specifics

QA runs **commands as criteria**, so use Gradle:

- `./gradlew :app:testDebugUnitTest` — unit tests (the main one)
- `./gradlew lint` — static checks
- `./gradlew assembleDebug` — a build check

Pick a feature that a **Gradle unit test can prove** — logic, a `ViewModel`, a mapper, validation,
formatting. Those get real evidence-backed verification.

> **Limit — read this:** flow does **not** drive an emulator or device yet (Android UI QA / "Layer C" is
> not built). So a purely **visual** UI change is not self-verified — only what your Gradle tests cover is.
> Keep your first feature small and unit-testable.

---

## The `flow_run` parameters (reference)

You normally don't type these — opencode fills them from your sentence. But if you drive another host, or
want to be explicit, these are the fields:

| Field | What it is |
|---|---|
| `runId` | A name for this run (required). |
| `targetDir` | **Absolute** path of the repo to change (required). |
| `objective` | One sentence: what to build (planner mode). |
| `acceptPlan` | `true` to execute the planned tasks. Omit it to get the plan back first ("plan pending"), then re-run with `true`. |
| `verifyCommand` | The command that proves the work, as an argv array, e.g. `["./gradlew",":app:testDebugUnitTest"]`. Run with no shell. |
| `deriveCriteria` | `false` to rely on your `verifyCommand`. Default `true` auto-derives QA criteria from the plan — handy, but they can be **over-strict and block a correct result**, so prefer an explicit `verifyCommand`. |
| `worktree` | `true` to isolate the run on a `flow/<runId>` branch (report returns `branch` + `worktreeDir`). Default `false` writes into the working tree. |
| `tasks` | Explicit task list — skips the planner entirely (advanced). |
| `maxSteps`, `contextRoot` | Optional bounds / repo-context root. |

Explicit call, for reference:

```json
{ "runId": "add-dark-mode", "targetDir": "/Users/me/apps/myapp",
  "objective": "Add a persistent dark-mode toggle to the settings screen",
  "worktree": true, "acceptPlan": true, "deriveCriteria": false,
  "verifyCommand": ["./gradlew", ":app:testDebugUnitTest"] }
```

---

## Other hosts & advanced setup

**opencode — manual JSON** (equivalent to the script). Add to `opencode.json`; raise the `timeout` — a
run takes minutes and opencode's MCP default is 5000 ms:

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

`scripts/flow-mcp.sh` loads your keys from `.env` and runs the live `dist/`. Any other stdio MCP host uses
the same idea: a `command` pointing at that launcher.

**Zero-clone via npx (from GitHub).** No clone, no build — npm fetches and builds a single self-contained
bundle on first launch:

```json
{ "mcp": { "flow": { "type": "local",
  "command": ["npx", "-y", "github:l3vram/flow-harness", "flow-mcp"],
  "enabled": true, "timeout": 600000 } } }
```

Trade-off: the npx bin does **not** read your `.env`, so the host/shell must supply the `FLOW_LLM_*`
provider vars itself. Pin a release with `github:l3vram/flow-harness#v0.34.0`. (Use `scripts/flow-mcp.sh`
when you want keys loaded from `.env` automatically.)

**Claude Code (inside this repo).** `.mcp.json` at the repo root already registers `flow` via
`scripts/flow-mcp.sh`. Claude Code picks it up on the next session/reload and asks you to approve the
server once — this is how the harness builds itself.

---

## Current limits

- **Android UI / device QA (Layer C) is not built yet** — no emulator/device is driven, so visual UI isn't
  self-verified. Logic covered by Gradle unit tests is.
- **Transport is stdio only** — a host launches the server as a local command (no HTTP URL / remote daemon
  yet). Run it locally so your toolchains (Android SDK, Gradle, Node) are available to the build and QA.
- `flow_run` is the lean library path (no lesson recording); the `flow-run` CLI records lessons.
