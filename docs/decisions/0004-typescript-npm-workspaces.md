# ADR 0004 — TypeScript + Node + npm workspaces

**Status:** accepted · 2026-08-30

## Context
The harness needs typed schemas, strong filesystem/process/Git support, and (later) a
first-class Playwright and MCP integration. The original architecture note proposed a
TypeScript + Node + pnpm monorepo.

## Decision
- **Language/runtime:** TypeScript on Node ≥ 22 (present on the dev machine: v22.22.0).
- **Package manager:** **npm workspaces**, not pnpm. pnpm is not installed here; npm ships with
  Node and needs zero setup. pnpm remains an option later — nothing in the code depends on it.
- **Module system:** ESM with `NodeNext` resolution; explicit `.js` import specifiers.
- **`@flow/core` has no runtime dependencies** beyond Node's standard library. Determinism and
  a small surface are worth more than convenience libraries this early.

## Consequences
- Build is `tsc -b` with project references (`core` before `cli`).
- Tests run on `vitest`; the CLI parity suite drives the built binary, so `npm test` builds
  first.
- Switching to pnpm later is a lockfile/CI change, not a code change.
