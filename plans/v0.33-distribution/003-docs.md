# Plan 003: Document the clean install path and `flow-mcp doctor`

> **Executor instructions**: Follow this plan step by step. Confirm each verification.
> If anything in "STOP conditions" occurs, stop and report. When done, update this plan's
> status row in `plans/v0.33-distribution/README.md`. This is a docs-only plan — do NOT
> modify any code or config.
>
> **Drift check (run first)**: `git diff --stat cb6ab98..HEAD -- README.md README.es.md docs/using-flow-via-mcp.md`
> If any changed materially since this plan was written, re-read them before editing.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: `001-doctor.md` (the `doctor`/`--version`/`--help` behavior), `002-distribution.md` (final install command, license, version 0.33.0)
- **Category**: docs
- **Planned at**: commit `cb6ab98`, 2026-09-07

## Why this matters

The whole point of this milestone is that someone (or you, on another machine) can install
flow-harness and confirm it works without opening this repo. That only lands if the install
command and the `doctor` check are documented. Without docs, the capability exists but is
undiscoverable.

## Current state

- `README.md` — English readme. Section headings, in order: `## What works today`,
  `## The one idea`, `## Packages`, `## Quickstart (Docker)`, `### Configure the LLMs per tier`,
  `## How it was built`. It has **no "Install"/npx section**.
- `README.es.md` — the Spanish translation of the readme (keep it in sync, in Spanish).
- `docs/using-flow-via-mcp.md` — the MCP runbook. It already covers building, provider keys,
  and registering the server in opencode/Claude Code. It does **not** mention `flow-mcp doctor`.
- After Plans 001–002: the binary supports `flow-mcp doctor`, `flow-mcp --version`,
  `flow-mcp --help`; the package is version `0.33.0`, MIT, publish-ready (not yet published);
  `npx github:l3vram/flow-harness flow-mcp` works today (the `prepare` script rebuilds the bundle
  on a git install).

## Scope

**In scope** (only these):
- `README.md` (edit — add an Install section)
- `README.es.md` (edit — add the same section in Spanish)
- `docs/using-flow-via-mcp.md` (edit — add a doctor subsection)

**Out of scope**: any code, `package.json`, or scripts. Do not invent install commands beyond
the two below. Do not claim the package is on npm (it is not published yet).

## Commands you will need

| Purpose        | Command                        | Expected                    |
|----------------|--------------------------------|-----------------------------|
| Sanity (doctor)| `node bin/flow-mcp.mjs doctor` | prints a report (exit 0 dev)|
| Markdown lint  | (none configured)              | —                           |

## Steps

### Step 1: Add an "Install" section to `README.md`

Insert a new section **immediately after** the `## What works today` section (before
`## The one idea`):

```markdown
## Install (use it outside this repo)

flow-harness ships as a single self-contained MCP server binary, `flow-mcp`.

**Today (from GitHub — no npm account needed):**
```bash
npx github:l3vram/flow-harness flow-mcp doctor   # verify the install
npx github:l3vram/flow-harness flow-mcp          # start the MCP stdio server
```
The `github:` install runs the `prepare` script, which rebuilds the bundle on your machine.

**Once published to npm (maintainer step):**
```bash
npm i -g flow-harness      # or: npx flow-harness flow-mcp
flow-mcp doctor
```

### Check your install: `flow-mcp doctor`

`flow-mcp doctor` runs an offline self-diagnostic and exits non-zero if something critical is
wrong — run it before pointing the server at a repo:

- **node** — requires Node >= 22 (`✗` if older).
- **llm:haiku / llm:sonnet / llm:opus** — the provider each tier resolves to. `!` means the
  offline `fake` provider (no real backend); a real provider without an API key is `✗`. Set
  `FLOW_LLM_<TIER>_API_KEY` (or the blanket `FLOW_LLM_API_KEY`).
- **git / playwright** — optional toolchains (`!` if absent); Playwright is only needed for
  web QA (Layer B).
- **tools** — confirms the 15 `flow_*` tools are wired into the binary.

Exit code `0` = ready (warnings allowed); `1` = a `✗` check must be fixed first.
`flow-mcp --version` and `flow-mcp --help` are also available.
```

(Note: the fenced block above contains nested code fences — when you write the file, keep the
inner ```bash fences intact.)

**Verify**: `grep -q "Install (use it outside this repo)" README.md && grep -q "flow-mcp doctor" README.md` → both match.

### Step 2: Mirror the section in `README.es.md` (Spanish)

Add the equivalent section in Spanish, in the same position relative to its headings. Translate
the prose; keep all commands, flags, env-var names, and the `flow_*` tool count identical.
Suggested heading: `## Instalación (úsalo fuera de este repo)` and subheading
`### Verifica tu instalación: \`flow-mcp doctor\``.

**Verify**: `grep -q "flow-mcp doctor" README.es.md` → matches.

### Step 3: Add a doctor subsection to `docs/using-flow-via-mcp.md`

Add a short subsection (after the build/keys sections, before or after the host-registration
section) titled `## Verify the install: flow-mcp doctor`, explaining that
`node bin/flow-mcp.mjs doctor` (or `flow-mcp doctor` when installed) reports Node version,
per-tier provider/key status, optional toolchains, and tool wiring, and exits non-zero on a
failed critical check. Mention running it right after setting `.env` keys and before the first
`flow_run`.

**Verify**: `grep -q "flow-mcp doctor" docs/using-flow-via-mcp.md` → matches.

## Test plan

- No automated tests (docs only). Verification is the `grep` checks above plus a human read for
  accuracy: the two install commands are exactly the `github:` form and the (future) npm form;
  nothing claims the package is already on npm.

## Done criteria

- [ ] `README.md` has the "Install (use it outside this repo)" section with both install forms and the doctor explanation
- [ ] `README.es.md` has the equivalent Spanish section (commands/flags unchanged)
- [ ] `docs/using-flow-via-mcp.md` documents `flow-mcp doctor`
- [ ] No non-docs files changed (`git status`)
- [ ] Status row updated in `plans/v0.33-distribution/README.md`

## STOP conditions

- The doctor flags/behavior described here don't match what Plan 001 actually shipped
  (re-read `packages/mcp-server/src/doctor.ts` and correct the docs to match reality).
- The install command `npx github:l3vram/flow-harness flow-mcp` errors when you try it (then the
  docs would be wrong — report it rather than documenting a broken command).

## Maintenance notes

- When the package is actually published to npm, remove the "(maintainer step)" caveat and
  promote the `npm i -g` form.
- Keep `README.md` and `README.es.md` in sync on every future install/doctor change.
