# Status — what exists, what remains

The north star: a **self-sufficient harness** that runs real, complex projects and can later
work on itself. We reach it by finishing solid, deterministic foundations first, then layering
reasoning on top. `PLAN.md` is the full architecture roadmap (56 sections); this file tracks
where we actually are.

Legend: ✅ done & tested · 🚧 in progress · ⬜ not started

---

## What exists (done & tested)

### v0.1 — deterministic runtime core ✅
The resumable spine everything else hangs from. **No LLM anywhere in it.**

- ✅ **`@flow/core`** — event-sourced runtime
  - Append-only event log (`.flow/events.jsonl`) as the source of truth.
  - Pure projection `project(events) → State`; `state.json` is a regenerable cache.
  - Kahn wave scheduler + cycle detection (names culprits, exits non-zero).
  - Task state machine with a 3-attempt circuit breaker.
  - Token/cost ledger and human gates (A/B).
- ✅ **`@flow/cli`** — the `flow` binary, a drop-in for `flow.sh`
  (`init|add|waves|set|ready|wave-done|advance|gate|budget|panel|report`).
- ✅ **Docker-first** — multi-stage image; compose services `test`, `flow`, `dev`.
  Run state persists on the `flow-state` volume.
- ✅ **16 tests green** — unit (waves, projection, circuit breaker), replay/resumability,
  and CLI parity (drives the real binary).

Acceptance met: CLI parity · rebuild state from the log after deleting the cache · breaker at
3 attempts · cycle → exit 2 with culprits · zero LLM in the core.

Decisions: see [`docs/decisions`](docs/decisions) (ADRs 0001–0005).

---

## What remains (in priority order)

### v0.4 — MCP server 🚧 (next)
Expose the runtime as MCP `flow_*` tools so **any** MCP host can drive it — the point at which
it stops being "a skill you invoke each time." Local transport is stdio; a real network daemon
(and `docker compose up`) arrives with remote deployment. Testable via the SDK's in-memory
transport (server + client), no processes required.

### v0.2 — provider abstraction + model router ⬜
One LLM provider adapter (Anthropic) behind an `LLMProvider` interface, plus a model router.
The first place a model is invoked. Provider-agnosticism is deliberately deferred — one
adapter now, more later, all behind the interface.

### v0.3 — executive ("CEO") loop ⬜
A thin observe→decide→plan→delegate→evaluate loop that reads/writes the event log, with human
gates on by default. Cannot edit product code directly.

### v0.5+ — the rest of the plan ⬜
Context engine · layered memory · research · QA engine + Playwright evidence · risk/review ·
repair/replan · evaluation harness · controlled learning/policy promotion · MCP resources &
apps · remote deployment. Each becomes its own package on top of the spine. Details per
section in `PLAN.md`.

---

## How this becomes "something that works on itself"
The event log is the substrate: once the MCP server (v0.4) and a brain (v0.2–v0.3) exist, we
point the harness at its **own** repository and use it to build its next increments — the same
way the `flow-dev-company` skill was used to evolve itself. That only works on top of a
deterministic, resumable, auditable core, which is why v0.1 came first.
