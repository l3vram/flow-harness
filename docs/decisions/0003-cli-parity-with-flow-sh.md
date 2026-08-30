# ADR 0003 — The `flow` CLI is a drop-in for `flow.sh`

**Status:** accepted · 2026-08-30

## Context
The existing skill calls `flow.sh init|add|waves|set|ready|wave-done|advance|gate|budget|
panel|report` and parses some of its output. We want to replace the engine without breaking
the skill.

## Decision
The `@flow/cli` `flow` binary reproduces every `flow.sh` subcommand, its output shape, and its
exit codes. **Parity is the acceptance test** (`parity.test.ts` drives the real binary).

## Intentional, backward-compatible improvements
- **Waves are derived, not stored.** `flow.sh` required calling `waves` to populate `.waves`
  before `ready` worked. Here waves are recomputed from the plan graph on every projection, so
  `ready`/`wave-done` are always correct. Calling `flow waves` still prints the layering and
  still exits 2 on a cycle.
- **Resumability.** State survives deletion of the cache (ADR 0002); `flow.sh` could not.

## Exit codes preserved
- `waves` → exit 2 when a dependency cycle is found, naming the culprits on stderr.
- `wave-done` → exit 1 while the wave is in progress.
- `advance` → exit 1 when the barrier blocks advancement.

## Consequences
- Output strings are effectively an API; changing them is a breaking change for the skill.
- Column widths in `panel` are human-facing and not asserted for byte-exactness.
