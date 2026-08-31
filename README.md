# flow-harness

An LLM-agnostic software-engineering harness. The long-term goal is a self-sufficient runtime
that owns orchestration, state, memory, planning, scheduling, QA, evidence and cost control —
with the LLM as an interchangeable reasoning engine, not the system.

This repository is the **foundation**, built deliberately from the bottom up. `v0.1` is the
deterministic spine everything else hangs from: a typed, event-sourced, resumable port of the
`flow.sh` orchestration plumbing. **No LLM is involved anywhere in the core.**

## Why this first

The previous incarnation was a Claude Code skill driving a bash script whose state lived in a
single mutable `state.json`. That is fine until a process dies mid-run, or you ask "how did we
get here?". Before adding an executive brain, providers, QA or learning, the runtime needs to
be **deterministic, resumable and auditable**. That is exactly what `v0.1` delivers.

## What's in v0.1

- **`@flow/core`** — the runtime.
  - Append-only event log (`.flow/events.jsonl`) as the source of truth.
  - Pure projection: `project(events) → State`. `state.json` is a regenerable cache.
  - Kahn wave scheduler with cycle detection.
  - Task state machine with a 3-attempt circuit breaker.
  - Token/cost ledger and human gates.
- **`@flow/cli`** — the `flow` command, a drop-in replacement for `flow.sh`
  (`init|add|waves|set|ready|wave-done|advance|gate|budget|panel|report`).
- **`@flow/mcp-server`** — an MCP server exposing the runtime as `flow_*` tools, so any MCP
  host can drive a run (stdio transport; bin `flow-mcp`, compose service `mcp`).

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the conceptual map (how it all fits together, with
diagrams), [`docs/decisions`](docs/decisions) for the architecture decisions, and
[`STATUS.md`](STATUS.md) for what exists and what remains.

## Quickstart (Docker — the primary workflow)

Everything runs in containers; nothing platform-specific is installed on the host. The same
image runs locally and remotely.

```bash
docker compose build            # build the test + runtime images

docker compose run --rm test    # run the full suite (build + unit + CLI-parity)

# drive the runtime — each call is a fresh container; state persists in the flow-state volume
docker compose run --rm flow init demo "build a small API"
docker compose run --rm flow add api backend sonnet
docker compose run --rm flow add ui  frontend haiku api
docker compose run --rm flow waves
docker compose run --rm flow panel
```

Run state (the `events.jsonl` log + `state.json` projection) lives in the named volume
`flow-state`, mounted at `/work` inside the container. To iterate on the source with the
suite in watch mode: `docker compose up dev`.

### Without Docker (optional)

Node ≥ 22 is the only requirement.

```bash
npm install
npm test          # builds, then runs the unit + CLI-parity suites
node packages/cli/dist/cli.js init demo "build a small API"
```

State lands in `./.flow/` (`FLOW_STATE` overrides the path).

## Acceptance criteria for v0.1

1. The `flow` CLI reproduces every `flow.sh` command's behaviour — verified by the parity suite.
2. Deleting `state.json` and replaying `events.jsonl` yields identical state (resumability).
3. The circuit breaker blocks a plan at 3 attempts.
4. A dependency cycle is detected, exits 2, and names the culprits.
5. Zero LLM in the core; the projector is a pure, deterministic fold.

## Where this grows (not built yet)

`v0.2` one LLM provider adapter + model router · `v0.3` a thin executive ("CEO") loop that
reads/writes events with human gates on by default · `v0.4` an MCP server exposing `flow_*`
tools so any MCP host can drive it — the point at which it stops being "a skill you invoke" ·
`v0.5+` context, memory, QA/Playwright evidence, and a controlled learning pipeline, each as
its own package on top of this spine.
