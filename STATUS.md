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

### v0.12–v0.14 — SDD planner + converge ✅ — *self-built*
The harness builds its own planning brain (GitHub Spec Kit / Spec-Driven Development).
- ✅ **`@flow/planner`** — objective → **spec** (requirements + acceptance + clarifications) → ordered
  **task DAG** with per-task verify. **Self-built (CEO on Gemini).**
- ✅ **v0.13** — wired into `flow-run`: objective → plan → **human gate** (exit 2; `acceptPlan:true` to
  execute) → run. Per-task `verifyCommand` override in the executor.
- ✅ **`@flow/converge`** — `converge(plan, outcomes)` → deterministic **done-vs-spec** report
  (green/pending, complete, open clarifications). **Self-built.**

### v0.15 — git worktree per run + PR gate ✅ — *self-built*
- ✅ **`@flow/git`** — `spawnSync` wrapper (no shell): `createWorktree`, `commitAll`, `changedFiles`…
  `flow-run "worktree": true` runs the whole thing on `flow/<runId>`, leaving the target's working
  tree untouched — the human reviews the branch as a PR. **Proven**: an isolated run created a file on
  its branch; master stayed clean.

### v0.2.3 — retry/backoff ✅
`fetchWithRetry` on 408/429/5xx (exponential backoff) across providers. **Proven**: rode through a Groq
429 (TPM limit) and a Gemini 503 (overload) without failing the run.

### v0.2.4 — automatic provider fallback ✅
Each tier can declare a **fallback** provider/model (`FLOW_LLM_<TIER>_FALLBACK_*`). If the primary's
`complete()` throws (saturation/outage after retries), `ModelRouter` auto-switches to the fallback —
e.g. Gemini(CEO) → Mistral, or Groq(exec) → Mistral `codestral`. Backward compatible (no fallback env →
one profile per tier, unchanged). **140 tests total, Docker-verified.**

### memory home — lessons persist across runs ✅
Lessons (the harness's cross-run memory) now live in a **stable** `FLOW_MEMORY_HOME` (default
`~/.flow-harness/lessons.jsonl`), separate from per-run state under `FLOW_HOME`. A throwaway `FLOW_HOME`
no longer discards what the harness has learned.

### providers — Mistral in the pool ✅
Mistral works plug-and-play via the OpenAI-compatible provider (`https://api.mistral.ai/v1`);
`codestral-latest` is the code-tier model. Available as a primary or a fallback on any tier.

### providers — OpenRouter in the pool ✅
OpenRouter is plug-and-play via the OpenAI-compatible provider (`https://openrouter.ai/api/v1`),
wired as an **execution-tier fallback** (`FLOW_LLM_SONNET_FALLBACK_*` / `FLOW_LLM_HAIKU_FALLBACK_*`) —
an overflow "extra pair of hands" for heavy parallel runs. Its `:free` models are slow, so it stays a
backup, never a primary. Keys live in a gitignored `.env` (template: `.env.example`); `docker-compose`
passes the fallback vars through to the `run`/`ceo`/`exec` services via a shared YAML anchor.

### v0.16 — planner + convergence over MCP ✅ — *self-built*
The MCP surface can now **plan and check convergence**, not just add/execute tasks.
- ✅ **`flow_spec`** — runs the SDD planner (`@flow/planner`) over MCP: objective (+ optional context/tier) →
  spec + ordered task DAG. Needs a real LLM backend.
- ✅ **`flow_converge`** — deterministic done-vs-spec report (`@flow/converge`) from a plan + task outcomes.
  Offline. (The pre-existing `flow_plan` tool computes *wave layering* and is unchanged; these are new names,
  deliberately, to avoid a collision.) **13 MCP tools total.**
- ✅ **Self-built**: authored by `flow-run` on the harness's own repo (CEO on Gemini, executor on Groq) in a
  single clean pass, under human Gates A/B. **+2 tests.**
- ✅ **Enabling fix — executor repair on apply failure**: an `applyChanges` failure (e.g. an EDIT whose search
  text is absent) no longer aborts the run — it becomes a failed verification the orchestrator's repair loop
  feeds back (with the current file content), bounded by `maxRepairAttempts`. **+2 tests. 144 tests total.**

### v0.17 — executor robustness ✅ — *self-built*
Closed the two gaps v0.16 surfaced, authored by `flow-run` on the harness's own repo (single clean pass on the
hardened executor, under human Gates A/B):
- ✅ **atomic apply** — `applyChanges` validates + folds the whole batch into an in-memory copy and writes only
  if all of it is valid, so a failure never leaves a partial (often non-compiling) tree; multiple edits to one
  file compose in order.
- ✅ **provider failure is not fatal** — a total provider failure (primary + fallback exhausted) becomes a failed
  verification (task blocked after the repair budget), so the run continues instead of crashing.
- ✅ **+3 tests (147 total).**

### v0.18 — `@flow/qa` (QA engine, Layer A) ✅ — *self-built*
The first brick of the QA engine ([ADR 0007](docs/decisions/0007-qa-independent-capability.md)): an
**independent**, run-less, **offline** capability — pure lib `@flow/qa` + bin `flow-qa`.
- ✅ `runQA({target, platform, criteria})` verifies each acceptance criterion with its **own explicit command**
  (spawnSync, no shell), writes **evidence** artifacts (stdout/stderr/exit) to disk, and returns a **QA report**
  with per-criterion pass/fail + error **tickets** (severity, symptom, evidence, repro, tags). It emits
  evidence/verdicts/tickets, **never decisions**; `complete` = all criteria pass.
- ✅ bin `flow-qa <target> <request.json>` (exit ≠0 unless complete) — a drop-in system verifier, proven standalone.
- ✅ **Self-built** by `flow-run` in a single clean pass. **+4 tests (151 total).**

### v0.19 — `flow_qa` over MCP ✅ — *self-built, dogfooded*
The QA engine is now reachable from any MCP host (opencode/Cursor/Claude) as a standalone tool — the
"usable independently" half of ADR 0007. `flow_qa` (14th tool) runs `@flow/qa`'s `runQA` (offline, run-less)
and returns the report + tickets. **Dogfooded**: the increment was accepted only after `flow-qa` itself
verified it (`{build, mcp-server-tests, qa-tests}` → 3/3 pass, evidence on disk) — the harness's first real
Requirement→Evidence→Done. **+1 test (152 total).**
*(Two robustness findings from the first, blocked attempt: adding a dep on a newly-created workspace package
needs `npm install`/the node_modules symlink before the auto-build; and the executor drifts out of file scope
under repair pressure. Both queued as executor/build-hygiene work.)*

### v0.20 — QA wired into the orchestrator ✅ — *self-built, dogfooded end to end*
The autonomous loop now **verifies with QA**. A `TaskSpec` may carry acceptance `criteria`; when it does, the
executor writes without a redundant verify command, the orchestrator runs `runQA` against the target, and the
report's `complete` (not a single exit code) decides green/blocked — its **tickets** drive the repair loop.
Backward compatible (no criteria → unchanged). Evidence goes to a temp dir, so a self-build never dirties the tree.
- ✅ **+2 tests (154 total)**; **self-built** by `flow-run` in one clean pass.
- ✅ **Dogfooded end to end**: a real `flow-run` whose task carried `criteria` went **green on the QA verdict**
  (`qa.complete`, report attached) — the first time the loop's accept decision was made by the QA engine.

### v0.21 — `@flow/qa` Layer B: the web-QA seam (offline) ✅ — *self-built*
The browser side of QA, testable without a browser. Structured web criteria
(`goto`/`expectText`/`expectSelector`/`screenshot`), a `WebDriver` interface, a deterministic `FakeWebDriver`
(the browser analogue of `FakeProvider`), and `runWebQA` returning the same `QAReport` (screenshots +
console/network evidence, tickets on failure). No new deps; fully offline. **+2 tests (156 total). Self-built.**
The real `PlaywrightDriver` + a live-browser smoke is v0.22 (supervised — browser binaries can't live in the
offline suite).

### v0.22 — `@flow/qa` Layer B: the real Playwright driver ✅ — *supervisor-built*
`PlaywrightDriver` implements `WebDriver` against a real browser, so `runWebQA` verifies a running web app with
real screenshots + console + network evidence. `playwright` is an **optionalDependency** loaded via a **non-literal
dynamic import**, so the package and its offline suite build/run without it. Proven with a **live-browser smoke**
(`packages/qa/smoke/playwright-smoke.mjs`): real Chromium drove a page — a passing criterion and a deliberately
failing one (ticket + failure screenshot). Built by hand (a real browser can't live in the offline `npm test`);
suite unchanged at **156**. Layer B is now complete (offline seam + real driver).

### v0.23 — run-scoped QA evidence ✅ — *self-built*
QA evidence produced during an autonomous run now lands under the run's own directory
(`<FLOW_HOME>/runs/<runId>/evidence/<taskId>/`) instead of a random temp dir — auditable and inspectable.
`OrchestratorOptions.evidenceDir` (set by `flow-run`) is threaded into `runQA`; with none set, behavior is
unchanged. **+1 test (157 total). Self-built.** This closes the QA loop's evidence story — **Priority 0 (QA) is
complete** for now (only planner-derived criteria, a judgment feature, remains — deferred to Priority 1).

### v0.24 — `@flow/verify`: derive QA criteria from acceptance ✅ — *self-built*
The Requirement→Verification node: `deriveCriteria(router, acceptance, context?)` turns the planner's free-text
acceptance statements into **executable** QA `Criterion[]` (an LLM step on `opus` + a deterministic parser),
directly consumable by `runQA`. A new package `@flow/verify` (deps `@flow/llm` + `@flow/qa`), offline-testable
with a scripted router — like the planner. **+4 tests (161 total). Self-built + dogfooded**: Gemini turned two
free-text acceptances into executable criteria (with commands, severity, tags). Follow-up: wire it into `flow-run`
(planner acceptance → derived criteria → orchestrator QA-verifies), closing requirement→evidence→done automatically.

### v0.25 — wire `deriveCriteria` into flow-run ✅ — *self-built, proven end to end*
Closes the QA loop automatically. In objective mode, `flow-run` now turns the planner's free-text `spec.acceptance`
into executable QA criteria (`@flow/verify`) and attaches them to the plan's final task (pure helper
`attachAcceptanceCriteria`; `RunConfig.deriveCriteria`, default true, opts in/out), so the whole objective is
QA-verified — with evidence + tickets — when the run completes, no hand-written criteria.
- ✅ **+2 tests (163 total). Self-built.**
- ✅ **Proven end to end**: a real objective-mode run built `hello.js`, derived the acceptance into a criterion,
  attached it to the final task, and the orchestrator marked it **green on the QA verdict** (`qa.complete`). The
  harness now takes an objective and returns evidence-verified done — **requirement → evidence → done is automatic.**

### v0.26 — dynamic replanning (step 1): the CEO can add tasks mid-run ✅ — *self-built*
Priority 1 begins. The CEO gains an **`add_task`** action (+ `newTasks`), so it can **extend the DAG during a run**
when execution reveals missing work — the foundational "create" of dynamic replanning (feasible because
`runtime.addTask` is event-sourced with no run-started guard; the Kahn waves recompute). The orchestrator applies it
by adding each new task to the runtime + specs; the CEO dispatches it on a later step. **+3 tests (166 total).
Self-built** (an existing exact-match `parseDecision` test needed `newTasks:[]` — updated). Proven by a unit test:
the CEO adds "b" mid-run, it runs and goes green, and the run completes.

### v0.27 — executor robustness: a parse failure routes to the repair loop ✅ — *self-built*
Closes the last un-caught executor throw path (surfaced by v0.26's auto-build): a **parse** error
("no file blocks", from `parseChanges`) no longer aborts the run — it becomes a failed verification the
orchestrator's repair loop feeds back, exactly as apply and provider failures do (v0.17). All three executor
failure modes now degrade to a repairable/blocked task. **+2 tests (168 total)**, including an end-to-end recovery
(attempt 1 no-file-blocks → retry → attempt 2 valid write passes, green). Self-built.

### v0.28 — repair→replan: the CEO diagnoses a blocked task and replans ✅ — *self-built*
Turns "repair → blocked → dead end" into "repair → diagnose → replan". The CEO's state snapshot now carries each
task's **`reason`** (the block/verify/QA diagnosis), and its prompt tells it: on a `blocked` task (repair budget
exhausted), diagnose from the reason and **`add_task`** a remediation (or `await_human`) rather than stopping —
never `complete` while critical work is blocked. **+3 tests (171 total)**, including an end-to-end run where a task
exhausts its repair budget and blocks, the CEO adds a remediation, and it goes green. Self-built.

### v0.29 — `@flow/research`: research before implementing ✅ — *self-built*
Priority-1 research: `research(router, query, context?)` synthesizes **structured findings + sources** for a
question (an LLM step + a deterministic parser — same shape as the planner/verify), so the CEO/executor can gather
context before writing code. New package `@flow/research` (dep `@flow/llm`), offline-testable with a scripted
router. **+4 tests (175 total). Self-built + dogfooded**: a real Gemini run turned an Android question (a Compose
dark-mode toggle) into 13 concrete findings + official docs sources. Follow-ups: a real web/GitHub search provider
behind the same function; wiring the CEO to research on uncertainty.

### v0.30 — `@flow/eval`: objective evaluation engine ✅ — *self-built*
Priority-1 evaluation: `evaluate(input)` scores a run **0–100 from its facts** (deterministic, no LLM) across five
dimensions — completion, verification (acceptance criteria passed), stability (blocked), efficiency (retries), safety
(critical tickets) — and `compare(a, b)` diffs two runs across versions (`better`/`worse`/`same`). New package
`@flow/eval` (no deps). **+4 tests (179 total). Self-built + demonstrated**: a good run scores 100, a poor run 34, and
compare reports the +66 delta. Follow-ups: build `EvalInput` from a `RunReport`+QA; per-version history; wire it into
the run report.

---

## What remains

The full, prioritized execution plan now lives in **[`plans/ROADMAP.md`](plans/ROADMAP.md)** — 17
capabilities in dependency order, each tagged done / partial / not-started: from a *verifiable factory*
(QA + evidence + requirement→verification graph + strong convergence) through autonomy (dynamic
replanning, research, evaluation, repair→replan), real learning (structured memory, controlled learning,
knowledge graph), security (capabilities, risk 2.0, sandboxing), and productization (full PR workflow,
deployment verification, observability, remote execution).

**The project's headline metric** is one repeated end-to-end test, not a package count: the harness builds
a web app from a spec — research → plan → implement → test → launch → Playwright the flows → detect+repair →
verify every requirement with **objective evidence** → branch + PR — and refuses `done` while any critical
requirement is unverified. Passing that on several distinct projects is the bar.

### Next ⬜ — MCP readiness (Android) + Priority 1 tail
**Research (v0.29) and evaluation (v0.30) shipped.** Next: **expose the autonomous run over MCP** — a `flow_run`
MCP tool (`{objective, targetDir, config}` → planner→CEO→executor→QA) + a **runbook** to register it and point it
at an external repo (an Android app), so a host like opencode can drive a feature-add. Still open: Android UI QA
(Layer C); `split`/`replace`/`invalidate`; wiring research into the loop; a helper that builds `EvalInput` from a
`RunReport`. See [`plans/ROADMAP.md`](plans/ROADMAP.md).

---

## How this becomes "something that works on itself"
The event log is the substrate: once the MCP server (v0.4) and a brain (v0.2–v0.3) exist, we
point the harness at its **own** repository and use it to build its next increments — the same
way the `flow-dev-company` skill was used to evolve itself. That only works on top of a
deterministic, resumable, auditable core, which is why v0.1 came first.
