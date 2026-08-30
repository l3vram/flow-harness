# ADR 0002 — Event-sourced state

**Status:** accepted · 2026-08-30

## Context
`flow.sh` treats `.flow/state.json` as the primary, mutable source of truth. That works, but
it cannot answer "how did we get here?", it has no audit trail, and a corrupted or
half-written file loses the run.

## Decision
The durable source of truth is an **append-only event log**, `.flow/events.jsonl`. State is a
**pure projection** produced by folding the log (`project(events) → State`). `state.json`
becomes a regenerable cache written after every mutation; deleting it is always safe.

## Rationale
- **Resumability / replay:** a process can die mid-run; a new `Runtime` over the same
  directory reconstructs the exact state from the log. Proven by `replay.test.ts`.
- **Auditability:** every transition — including policy actions like a circuit-breaker block —
  is a recorded event.
- **Deterministic core:** the projector has no clock, randomness, or I/O and no LLM. Given the
  same events it always yields the same state.

## Consequences
- All mutations must go through appended events; never hand-edit `state.json`.
- Policy that reacts to a transition (the circuit breaker) lives in the command layer and is
  expressed as an additional event, keeping the projector a dumb fold.
- A future compaction/snapshot step may be added if logs grow large; not needed at this scale.
