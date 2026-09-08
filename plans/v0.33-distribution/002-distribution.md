# Plan 002: Make the package publish-ready (clean one-command install)

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If anything in "STOP
> conditions" occurs, stop and report. When done, update this plan's status row in
> `plans/v0.33-distribution/README.md`.
>
> **Drift check (run first)**: `git diff --stat cb6ab98..HEAD -- package.json`
> If `package.json` changed since this plan was written, compare the "Current state"
> excerpt against the live file before proceeding; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED (touches distribution metadata; a wrong `files`/`private` ships the wrong tree)
- **Depends on**: none (disjoint files from Plan 001)
- **Category**: dx
- **Planned at**: commit `cb6ab98`, 2026-09-07

## Why this matters

Today the only way to install flow-harness elsewhere is `npx github:l3vram/flow-harness`,
which works but is unversioned and rough, and the root package is marked `"private": true`
so it can never be published to npm. To be "usable outside this console" the package must be
publish-ready: not private, shipping exactly the self-contained bundled binary (not the whole
monorepo), with a license and a build-on-publish hook. **This plan does NOT publish** — it makes
the package ready so a human can `npm publish` as a deliberate, credentialed step.

## Current state

`package.json` (root) — current full contents:

```json
{
  "name": "flow-harness",
  "version": "0.32.0",
  "private": true,
  "type": "module",
  "description": "LLM-agnostic software engineering harness — deterministic, resumable, event-sourced runtime core.",
  "repository": { "type": "git", "url": "github:l3vram/flow-harness" },
  "bin": { "flow-mcp": "bin/flow-mcp.mjs" },
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "tsc -b",
    "clean": "tsc -b --clean",
    "bundle": "node scripts/bundle-mcp.mjs",
    "prepare": "npm run build && npm run bundle",
    "test": "npm run build && vitest run",
    "test:watch": "vitest",
    "flow": "node packages/cli/dist/cli.js"
  },
  "devDependencies": { "@types/node": "^22.10.0", "esbuild": "^0.24.0", "typescript": "^5.6.3", "vitest": "^2.1.8" },
  "engines": { "node": ">=22" }
}
```

Key facts:
- The runtime artifact is `bin/flow-mcp.mjs` — a **self-contained** esbuild bundle of the whole
  `@flow/*` graph + the MCP SDK (only `playwright` stays external). So a published package needs
  **only** that file + docs at runtime; the `packages/*` sources are NOT needed by consumers.
- Every workspace package under `packages/*` is itself `"private": true` (version `0.1.0`) — those
  must stay private and are not published.
- `prepare` runs on `npm install` and on `npx github:` installs, so it rebuilds the bundle there.
  Registry installs (`npm i flow-harness`) do NOT run `prepare`; they use the shipped bundle — which
  is why the prebuilt `bin/flow-mcp.mjs` must be in the published `files`.
- There is **no `LICENSE` file** and no `"license"` field.

## Commands you will need

| Purpose           | Command                              | Expected on success                          |
|-------------------|--------------------------------------|----------------------------------------------|
| Build             | `npm run build`                      | exit 0                                        |
| Bundle            | `npm run bundle`                     | prints `bundled -> .../bin/flow-mcp.mjs`      |
| Pack (dry run)    | `npm pack --dry-run`                 | lists ONLY the files in `files` + package.json |
| Doctor smoke      | `node bin/flow-mcp.mjs doctor`       | prints a report (exit 0 in dev)               |

## Scope

**In scope** (only these):
- `package.json` (root) — edit metadata + scripts + `files`; bump version.
- `LICENSE` (create).

**Out of scope** (do NOT touch):
- Any `packages/*/package.json` — the child packages stay `private`.
- `scripts/bundle-mcp.mjs` and `packages/mcp-server/*` — Plan 001 owns those.
- **Do NOT run `npm publish`** — publishing is a human step, out of scope entirely.
- Do NOT add or upgrade dependencies.

## Git workflow

- Conventional-commit message (e.g. `feat: v0.33 publish-ready package (self-contained bin, license, files)`).
- Do NOT push, tag, publish, or open a PR.

## Steps

### Step 1: Create `LICENSE`

Create a `LICENSE` file at the repo root with the **MIT License**, copyright line:
`Copyright (c) 2026 flow-harness contributors`.
Use the standard MIT text.

> If the operator has told you a different license is required, STOP and report instead of
> guessing — the license is a legal decision, not an implementation detail.

**Verify**: `test -f LICENSE && head -1 LICENSE` → shows `MIT License`.

### Step 2: Edit `package.json`

Apply exactly these changes:

1. Bump `"version"` from `"0.32.0"` to `"0.33.0"`.
2. Remove `"private": true`.
3. Add `"license": "MIT"` (after `"description"`).
4. Add a `"files"` array shipping only what a consumer needs to run the bundled server:
   ```json
   "files": ["bin/flow-mcp.mjs", "README.md", "LICENSE"]
   ```
5. Add `"publishConfig": { "access": "public" }`.
6. Add a `"prepublishOnly"` script that guarantees a fresh bundle at publish time:
   ```json
   "prepublishOnly": "npm run build && npm run bundle"
   ```
7. Leave `bin`, `workspaces`, `engines`, `type`, `repository`, and all existing scripts unchanged.

The resulting `scripts` block keeps every existing key and adds `prepublishOnly`. The resulting
top of the file should read (order may vary, content must match):

```json
{
  "name": "flow-harness",
  "version": "0.33.0",
  "type": "module",
  "description": "LLM-agnostic software engineering harness — deterministic, resumable, event-sourced runtime core.",
  "license": "MIT",
  "repository": { "type": "git", "url": "github:l3vram/flow-harness" },
  "bin": { "flow-mcp": "bin/flow-mcp.mjs" },
  "files": ["bin/flow-mcp.mjs", "README.md", "LICENSE"],
  "publishConfig": { "access": "public" },
  "workspaces": ["packages/*"],
  ...
}
```

**Verify**: `node -e "const p=require('./package.json'); if(p.private) throw 'still private'; if(p.version!=='0.33.0') throw 'version'; if(!p.license) throw 'license'; if(!Array.isArray(p.files)) throw 'files'; console.log('ok')"` → prints `ok`.

### Step 3: Confirm the pack manifest is exactly the bundle + docs

First ensure the bundle exists (`npm run build && npm run bundle`), then:

**Verify**: `npm pack --dry-run 2>&1 | sed -n '/Tarball Contents/,/Tarball Details/p'`
→ the listed files are **only**: `bin/flow-mcp.mjs`, `README.md`, `LICENSE`, `package.json`.
No `packages/**`, no `node_modules`, no sources. (If `README.md`/`LICENSE` are missing, they
won't list — both must be present.)

### Step 4: Smoke the published shape

**Verify**: `node bin/flow-mcp.mjs doctor` → prints a report (exit 0 in dev). If Plan 001 has
not landed yet in this worktree, `doctor` may not exist — in that case run
`node bin/flow-mcp.mjs --help 2>/dev/null; echo "server-entry present: $?"` and confirm the file
runs without a load error; note in your report that the doctor smoke depends on Plan 001.

## Test plan

- No unit tests (this is packaging metadata). Verification is the `npm pack --dry-run` manifest
  and the `node -e` assertion in Step 2.
- Full suite must still pass: `npm run build && npx vitest run` → all green (unchanged count).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `LICENSE` exists (MIT)
- [ ] `package.json` has no `private`, `version` is `0.33.0`, has `license`, `files`, `publishConfig`, `prepublishOnly`
- [ ] `npm pack --dry-run` manifest is exactly `bin/flow-mcp.mjs`, `README.md`, `LICENSE`, `package.json`
- [ ] `npm run build && npx vitest run` → all pass (unchanged count)
- [ ] Only `package.json` and `LICENSE` changed (`git status`), plus the regenerated `bin/flow-mcp.mjs`
- [ ] `npm publish` was NOT run
- [ ] Status row updated in `plans/v0.33-distribution/README.md`

## STOP conditions

Stop and report (do not improvise) if:

- The live `package.json` does not match the "Current state" excerpt.
- `npm pack --dry-run` lists any `packages/**` or `node_modules` file — the `files` field is wrong;
  do not ship a bloated or source-leaking tarball.
- The operator has not confirmed the license and you are unsure MIT is acceptable.
- Anything tempts you to run `npm publish` — do not; it is a human step.

## Maintenance notes

- Because the bundle is self-contained, consumers never install the `@flow/*` workspaces; keep
  those `private`. If a consumer ever needs a workspace package directly, that's a separate decision.
- `files` deliberately omits sources. If you add a runtime asset the bundle reads from disk (it
  currently reads none), add it to `files` too.
- The actual `npm publish` (and `npm version`/tagging) is the maintainer's deliberate, credentialed
  step — see the README section Plan 003 adds. Reviewer should confirm no secrets or `.env` land in
  the pack manifest.
