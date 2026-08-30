# ADR 0001 — A new project, not a branch of the skill

**Status:** accepted · 2026-08-30

## Context
`flow-dev-company` exists today as a Claude Code skill: Markdown instructions plus a 191-line
`flow.sh` (bash + jq). The goal is to evolve it into a self-sufficient harness — a real
runtime with durable state — so it stops being "a skill you invoke every time."

## Decision
Build the harness as a **new project** (`flow-harness`), a sibling of the incubation notes,
not as a branch of the skill repository.

## Rationale
- A TypeScript runtime and a Markdown+bash skill are categorically different artifacts. One
  git history holding both invites confusion in tooling, CI, and review.
- The skill keeps working, untouched, as the "v1" tool while the harness matures.
- Per ADR 0003 the harness exposes a `flow` CLI that is a drop-in for `flow.sh`, so the
  existing skill can point at the new runtime without either repo entangling the other.

## Consequences
- The skill later becomes a thin adapter that shells out to `flow` / the harness.
- Two repos to maintain until the skill is retired or reduced to an adapter.
