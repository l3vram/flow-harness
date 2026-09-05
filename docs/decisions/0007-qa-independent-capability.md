# ADR 0007 — QA is an independent capability (lib → bin → MCP), report as its contract

**Status:** accepted · 2026-09-04

## Context
The QA engine (roadmap Priority 0) verifies the real product and drives the fix loop. But the project
has a dual goal: run as an autonomous "company" **and** be integrable into any external product — usable
all-together or independently. Examples the goal must support: register the harness as an MCP in a host
like opencode and say "build an iOS app that does X" so it runs the whole process; or call QA on its own
to verify tasks produced by a different CLI. The question is whether QA is built into the orchestrator or
stands alone.

## Decision
Build QA on the **same seam every `@flow/*` package already uses**: a pure library `@flow/qa`, a thin bin
`flow-qa`, and an MCP tool `flow_qa`. It is NOT coupled to the orchestrator/CEO; the orchestrator *consumes*
it.

Its interface is a **contract**, not the harness's internal state:
- `flow_qa` is **run-less** — input `{ target (dir or URL), acceptance criteria / suite descriptor,
  platform }`; output a serializable **QA report**: per-criterion pass/fail + **evidence artifacts** written
  to a run-scoped evidence dir (screenshots, traces, console, network, raw results) + a list of structured
  **error tickets**.
- QA produces **evidence, verdicts and tickets — not decisions.** It never marks "done" or decides how to
  fix; the CEO (or any other consumer) does.
- The report/ticket **schema** lives in a small shared types module, so consumers depend on the contract,
  not on `@flow/qa` internals (as `@flow/converge` depends only on the `Plan` type).

Scope ships in layers: **A** deterministic suites (unit / integration / API in a sandbox) → **B** Playwright
web E2E (launch the app, drive flows, capture evidence) → **C** Android/iOS via emulators (its own
sub-roadmap). Build order mirrors v0.16: package + bin first, expose over MCP second, wire into the
orchestrator third.

## Rationale
- **"Autonomous company" and "integrable product" are the same architecture seen from two sides.** The
  company is one composition of capabilities; integration is any host composing a subset — same package,
  same two surfaces (bin + MCP), no extra work to get both.
- **The MCP server is the universal adapter.** opencode/Cursor/Claude speak MCP; `flow_qa` slots in beside
  `flow_execute`/`flow_spec`/`flow_converge`, so a host can run just QA or the whole loop.
- **Contract-first keeps QA reusable and single-responsibility**, and preserves the founding invariant:
  deterministic evidence is the truth; judgment (triage/fix) stays in the LLM layer, outside QA.
- **Evidence as inspectable artifacts** serves humans and the CEO now, and the future knowledge graph later.

## Consequences
- `flow_qa` must work with **zero prior flow state** (like `flow_spec`/`flow_converge`), so another CLI or
  host can verify a target directly.
- The QA report/ticket schema becomes an interface — changing it is a breaking change for consumers.
- Mobile (Layer C) needs device/emulator infrastructure and is deliberately deferred; web (A+B) is the
  first cut.
- Global-CLI use (`flow-qa` as a system tool) is for scripting/CI; MCP is the primary integration path.
