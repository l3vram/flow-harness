# flow-harness

**[English](README.md) · [Español](README.es.md)**

An **LLM-agnostic software-engineering harness**: a deterministic, resumable runtime that plans,
executes, verifies and reviews software work — with the LLM as an interchangeable reasoning
engine, not the system.

The runtime owns orchestration, state, scheduling, memory, cost and safety. The model decides
*what* should happen; the runtime decides *how* it happens, reproducibly. Judgment runs on a
strong model, execution on a cheap one — configured per tier.

> Status: an **alpha of the engine**, built bottom-up and fully tested. It runs real autonomous
> loops under human gates and has authored several of its own packages — but it is not yet a
> turnkey product for arbitrary repositories. The foundations are solid; each remaining capability
> is a well-defined package on the same spine. See [`STATUS.md`](STATUS.md).

## What works today

- **Autonomous loop, end to end** — a CEO decides the next move, an executor writes/edits code and
  verifies it, the runtime advances waves, all under human gates. Proven with real inference.
- **Any inference, per role** — each tier (`haiku`/`sonnet`/`opus`) maps to its own provider/model
  via env: e.g. the CEO on Anthropic or Gemini, execution on Groq. Providers are zero-dependency
  (OpenAI-compatible + Anthropic Messages API) over the global `fetch`. A tier can declare an
  automatic **fallback** (e.g. OpenRouter) that the router switches to when the primary saturates —
  overflow capacity for heavy parallel runs, with retry/backoff underneath.
- **Edits real code** — a safe search/replace editor (the search text must match exactly once,
  paths confined to the target dir), not just whole new files.
- **A brain that uses its pieces** — the CEO decides with recalled **lessons** (memory) and repo
  **context**; a **risk engine** routes high-risk changes to human review.
- **Learns** — every run records a lesson; later runs recall them.
- **Two interfaces** — a `flow` CLI (a drop-in for the original `flow.sh`) and an **MCP server**
  (`flow_*` tools incl. `flow_execute`, `flow_spec`/`flow_converge`, and `flow_qa` — plan, verify with
  evidence, and check convergence over MCP), so any MCP host can drive it.
- **Built by itself** — packages like `@flow/memory` and `@flow/review` were authored by the
  harness running on its own repository, under human review.
- **Everything runs in Docker.** 161 tests. The core is deterministic — no LLM in it.

## The one idea

**Deterministic control flow lives in code; judgment lives in the LLM.** State is an event-sourced
projection you can delete and rebuild; scheduling and the circuit breaker are arithmetic; the LLM
is called only where judgment is needed.

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the conceptual map (with diagrams),
[`STATUS.md`](STATUS.md) for the milestone tracker, and [`docs/decisions`](docs/decisions) for the
architecture decision records.

## Packages

| Package | Role |
|---|---|
| `@flow/core` | Event-sourced runtime: log, projection, Kahn wave scheduler, circuit breaker, ledger, gates |
| `@flow/cli` | The `flow` command (drop-in for `flow.sh`) |
| `@flow/mcp-server` | MCP server: `flow_*` tools incl. `flow_execute` |
| `@flow/llm` | Provider-neutral inference; per-tier routing; OpenAI-compatible + Anthropic |
| `@flow/context` | Deterministic repo index + relevance ranking + token-budgeted context |
| `@flow/ceo` | The executive loop — decides the next move (with memory + context) |
| `@flow/executor` | Writes and **edits** code, then runs the verify command (the only writer of product code) |
| `@flow/orchestrator` | The conductor: CEO → executor → runtime, with risk gating and lesson recording (`flow-run`) |
| `@flow/memory` | Append-only lessons store + relevance search |
| `@flow/review` | Deterministic risk/review engine |
| `@flow/planner` | Spec-Driven Development planner: objective → spec → ordered task DAG with per-task verify |
| `@flow/converge` | Done-vs-spec convergence report (green/pending, complete, open clarifications) |
| `@flow/git` | Git worktree per run + PR gate — isolates a run on its own branch, working tree untouched |
| `@flow/qa` | Deterministic QA engine: per-criterion verification (Layer A) + web E2E via Playwright (Layer B) + evidence + error tickets; standalone lib + `flow-qa` bin |
| `@flow/verify` | Derives executable QA criteria from free-text acceptance (planner → QA): an LLM step + a deterministic parser |

## Quickstart (Docker)

```bash
docker compose build
docker compose run --rm test        # build + the full suite

docker compose run --rm flow init demo "build a small API"
docker compose run --rm flow add api backend sonnet
docker compose run --rm flow waves
docker compose run --rm flow panel
```

### Configure the LLMs per tier

Each tier can use a different provider/model. Example — CEO on a strong model, execution on a
cheap/fast one:

```bash
# CEO tier (opus) — e.g. Gemini via its OpenAI-compatible endpoint, or Anthropic
FLOW_LLM_OPUS_PROVIDER=openai
FLOW_LLM_OPUS_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
FLOW_LLM_OPUS_API_KEY=...        FLOW_LLM_OPUS_MODEL=gemini-2.5-pro
#   (Anthropic instead: FLOW_LLM_OPUS_PROVIDER=anthropic  FLOW_LLM_OPUS_API_KEY=...  FLOW_LLM_OPUS_MODEL=claude-opus-5)

# execution tiers (sonnet/haiku) — e.g. Groq
FLOW_LLM_SONNET_PROVIDER=openai
FLOW_LLM_SONNET_BASE_URL=https://api.groq.com/openai/v1
FLOW_LLM_SONNET_API_KEY=...      FLOW_LLM_SONNET_MODEL=openai/gpt-oss-120b

# optional per-tier fallback — overflow when the primary saturates (OpenRouter shown;
# OpenAI-compatible, its :free models are slow but a fine extra pair of hands)
FLOW_LLM_SONNET_FALLBACK_PROVIDER=openai
FLOW_LLM_SONNET_FALLBACK_BASE_URL=https://openrouter.ai/api/v1
FLOW_LLM_SONNET_FALLBACK_API_KEY=sk-or-v1-...   FLOW_LLM_SONNET_FALLBACK_MODEL=deepseek/deepseek-chat-v3-0324:free
```

With no config it defaults to a deterministic offline fake provider, so tests and dry runs need no
API key. Keys live in a gitignored `.env` (copy [`.env.example`](.env.example)); `docker compose`
loads it automatically. An autonomous run is a JSON config driven by `flow-run` (see
[`examples/run.example.json`](examples/run.example.json)).

## How it was built

The harness was built with the `flow-dev-company` orchestration skill (an expensive "brain" plans
and reviews, cheap agents execute in isolation) — and, increasingly, **by itself**: recent
features were written by `flow-run` driving the harness against its own repository, with a human
approving the plan and reviewing every diff.
