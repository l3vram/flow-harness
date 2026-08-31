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

### v0.2 — provider abstraction + model router ✅
A provider-neutral inference layer so the harness can call **any** inference backend, with
**no vendor SDK dependency** and **fully testable with zero API keys**.

- ✅ **`@flow/llm`** — `LLMProvider` interface, `FakeProvider` (deterministic offline echo) and
  `OpenAICompatibleProvider` (any `/chat/completions` backend — OpenAI, OpenRouter, Groq,
  Together, vLLM, LM Studio, Ollama `/v1`, …) over the global `fetch`. No external runtime
  dependencies.
- ✅ **`ModelRouter`** — resolves a `Tier` (`haiku`/`sonnet`/`opus`/custom) to a provider +
  model; `routerFromEnv()` builds one from `FLOW_LLM_*` env vars, defaulting to the fake
  provider.
- ✅ bin `flow-llm`; compose service `llm` (`docker compose run --rm llm "<prompt>"`).
- ✅ **17 new tests** (fake provider, openai-compatible over an injected fetch, router
  resolution, and `routerFromEnv` incl. treating empty-string env vars as unset). **41 tests
  green total.**

### v0.4 — MCP server ✅
Expose the runtime as MCP `flow_*` tools so **any** MCP host can drive a run — the point at
which it stops being "a skill you invoke each time."

- ✅ **`@flow/mcp-server`** — 10 tools: `flow_start`, `flow_add_task`, `flow_plan`,
  `flow_ready`, `flow_set`, `flow_advance`, `flow_gate`, `flow_budget`, `flow_status`,
  `flow_report`. Runs isolated under `<FLOW_HOME>/runs/<runId>/`.
- ✅ stdio transport (bin `flow-mcp`); compose service `mcp`.
- ✅ **8 tests**: tool handlers, an in-memory client↔server round trip, plus a real stdio
  smoke test of the container speaking the protocol. **24 tests green total.**

Local transport is stdio; a network (HTTP) transport and a real `docker compose up` daemon
arrive with remote deployment.

Decisions: see [`docs/decisions`](docs/decisions) (ADRs 0001–0006).

### v0.3 — executive ("CEO") loop ✅
A deliberately *thin* executive: observes a run's state and asks the LLM for the single next
move as structured JSON, then applies only DAG-safe actions.

- ✅ **`@flow/ceo`** — four actions (`dispatch`, `advance`, `await_human`, `complete`); the CEO
  **never writes or edits code**, never mutates state except through `@flow/core`'s typed
  methods, and only ever auto-applies `advance` when the current wave is actually done —
  everything else (including every `dispatch`) is handed back to the caller/human. Model-reported
  `confidence` is recorded for humans only, never used to gate anything automatically.
  Fully testable offline with the `FakeProvider`.
- ✅ bin `flow-ceo`; compose service `ceo` (`docker compose run --rm ceo <runId>`).
- ✅ **14 new tests** (decision parsing incl. embedded-prose and confidence clamping, `decide`/
  `step`/`run` against a scripted `FakeProvider`). **55 tests green total.**

### v0.5 — context engine ✅
A deterministic, **LLM-free** context engine: index a project directory, rank files against a
query, and assemble a token-budgeted bundle of snippets with source attribution — so the brain
(CEO) and future executors decide with repo context instead of cold exploration.

- ✅ **`@flow/context`** — `indexProject` (recursive, ignore-aware, binary/oversized-file
  skipping, sorted by path for determinism), `scoreEntry`/`tokenize` (deterministic path +
  content scoring, no randomness/clock/network/LLM), and `ContextEngine.assemble` (greedy
  token-budgeted packing with snippet extraction).
- ✅ Token-budgeted `ContextBundle` output (`items`, `sources`, `tokenBudget`,
  `estimatedTokens` — an estimate, never a billed count).
- ✅ bin `flow-context`; compose service `context`
  (`docker compose run --rm context "circuit breaker"`).
- ✅ **7 new tests** (indexer walk/ignore/binary/size rules, score heuristics, engine ranking
  and budget packing). **62 tests green total.**

---

## What remains (in priority order)

### v0.6+ — the rest of the plan ⬜ (next)
Layered memory · research · QA engine + Playwright evidence · risk/review · repair/replan ·
evaluation harness · controlled learning/policy promotion · MCP resources & apps · remote
deployment. Each becomes its own package on top of the spine. Details per section in
`PLAN.md`.

---

## How this becomes "something that works on itself"
The event log is the substrate: once the MCP server (v0.4) and a brain (v0.2–v0.3) exist, we
point the harness at its **own** repository and use it to build its next increments — the same
way the `flow-dev-company` skill was used to evolve itself. That only works on top of a
deterministic, resumable, auditable core, which is why v0.1 came first.
