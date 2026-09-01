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

- ✅ **`@flow/mcp-server`** — 11 tools: `flow_start`, `flow_add_task`, `flow_plan`,
  `flow_ready`, `flow_set`, `flow_advance`, `flow_gate`, `flow_budget`, `flow_status`,
  `flow_report`, and **`flow_execute`** (v0.4.1 — runs a task through the executor over MCP:
  the model writes files, verify runs, the task is set green/blocked). Runs isolated under
  `<FLOW_HOME>/runs/<runId>/`. Proven over the real protocol: a feature was built end-to-end
  via MCP (`flow_start → flow_add_task → flow_execute` with Groq).
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

### v0.6 — executor ✅
The keystone that turns a task into real work: given a task instruction and optional repository
context, asks the model for the full contents of every file it needs, applies them inside a
target directory only, then runs a configured verify command and reports the result. It is the
only component that writes product code.

- ✅ **`@flow/executor`** — path safety (`isSafeRelativePath`: rejects empty, leading `/`,
  backslashes, and any `.`/`..` segment) plus an independent containment guard in `applyChanges`
  (defense in depth); the verify command comes only from `ExecutorOptions.verifyCommand`, never
  from model output; writes only under `targetDir`.
- ✅ bin `flow-exec`; compose service `exec` with an isolated named volume `exec-work:/work` (the
  executor never writes into the repo itself)
  (`docker compose run --rm exec /work "create hello.js that prints hi"`).
- ✅ **24 new tests** (path/JSON parsing incl. unsafe-path rejection, apply's containment guard,
  verify's pass/fail/output capture, and end-to-end runs against a scripted `FakeProvider`).
  **86 tests green total.**

### v0.7 — orchestrator (autonomous loop) ✅
The integration seam: a conductor that drives a full autonomous run by wiring the existing
pieces together, with **no new judgment logic** of its own.

- ✅ **`@flow/orchestrator`** — `Orchestrator.run()` loops the CEO's decision (`dispatch`
  deterministically runs every `runtime.ready()` task through the executor, `advance` moves the
  wave forward when it's actually done, `await_human`/`complete` stop the run), the executor
  implements and verifies each dispatched task, and the runtime tracks status and wave
  membership. Bounded by `maxSteps`; stops early when nothing is ready. Optional `@flow/context`
  wiring assembles repo context per task instruction.
- ✅ bin `flow-run`; compose service `run`
  (`docker compose run --rm run /work/config.json`; needs a real LLM backend).
- ✅ **3 new tests** (happy path across two dependent tasks, a verify failure that blocks a task
  and prevents completion, and a dispatched task with no matching spec handled safely).
  **89 tests green total.**

### v0.8 — lessons memory ✅ — *authored by the harness itself*
The first increment the harness built of itself. Driven by `flow-run` under human gates: the
human approved the plan (Gate A), the CEO dispatched, the executor (Groq `openai/gpt-oss-120b`,
via the v0.6.1 file-block format) wrote all 8 files, verify ran `npx vitest run packages/memory`
(4 tests pass), and the CEO paused at Gate B for the human's review. The brain reviewed the code
and integrated it (`tsc -b` clean, full suite green). git confirmed only this package was created.

- ✅ **`@flow/memory`** — `MemoryStore` over an append-only JSONL log (`add`/`all`, deterministic);
  `searchLessons` ranks lessons by query-term overlap (reusing `@flow/context`'s tokenizer),
  returning top-K.
- ✅ **4 new tests** (store round-trip + empty-file, search ranking + `k` limit + no-match).
  **94 tests green total.**
- ✅ **Wired into the loop:** `flow-run` now records one lesson per run into
  `<FLOW_HOME>/lessons.jsonl`. Verified end-to-end — building `@flow/review` recorded a lesson and
  `searchLessons` recalled it. The harness now learns from each feature it builds.

### v0.9 — risk/review engine ✅ — *self-built*
Authored by the harness via `flow-run` (Groq); the brain reviewed it (clean) and integrated it.

- ✅ **`@flow/review`** — `assessRisk(input)` scores a change by security surface, file/line
  complexity and verify failure, then recommends `level` (low/medium/high), `reviewDepth`,
  `recommendedTier`, and whether a `humanGate` is needed. Deterministic, no deps.
- ✅ **3 new tests** (low / high / medium assessments). **101 tests green total.**

### flow_execute — execution over MCP ✅ (v0.4.1)
The MCP surface can now build, not just manage the runtime. Proven end-to-end over the real
protocol (`flow_start → flow_add_task → flow_execute` with Groq wrote a real test file).

### v0.2.2 — multi-LLM routing per tier ✅
Each tier (`haiku`/`sonnet`/`opus`) uses its own provider/model via `FLOW_LLM_<TIER>_*` env (fallback
to global). New `AnthropicProvider` (raw Messages API). **Proven**: a run with the CEO on Claude and
the executor on Groq.

### v0.10 — the brain is wired ✅
The CEO decides with recalled **lessons** (memory) + repo **context** (an advisor brief); the
orchestrator routes **high-risk** changes to `review` (`assessRisk`). Every `flow-run` records a
lesson (memory learns from each feature).

### v0.6.2 — the executor EDITS existing files ✅
Safe `<<<EDIT>>>` search/replace (unique-match, path-confined) alongside `<<<FILE>>>` create. **The
#1 unlock: from "adds new files" to "modifies real code".** Proven with Groq editing a real file.

### v0.11 — repair loop ✅
A failed verify is fed back (error + current file contents) so the executor EDITs to fix, bounded by
`maxRepairAttempts`. **Proven**: attempt 1 failed → the harness read the error and fixed itself →
attempt 2 passed. Runs now converge. **121 tests total.**

---

## What remains (in priority order)

### Next ⬜
- **git worktree per run + PR gate** (Fase A part 2 — isolate runs, review a real PR).
- **planner** (objective → task DAG; the CEO still can't decompose an objective into tasks).
- QA engine + Playwright (browser evidence) · evaluation harness · controlled learning · provider
  retry/backoff/fallback · MCP resources & apps · remote deployment. Each is its own package on the
  spine; details per section in `PLAN.md`.

---

## How this becomes "something that works on itself"
The event log is the substrate: once the MCP server (v0.4) and a brain (v0.2–v0.3) exist, we
point the harness at its **own** repository and use it to build its next increments — the same
way the `flow-dev-company` skill was used to evolve itself. That only works on top of a
deterministic, resumable, auditable core, which is why v0.1 came first.
