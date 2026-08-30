# ADR 0006 — MCP is the interoperability boundary

**Status:** accepted · 2026-08-30

## Context
The goal is for the harness to stop being "a skill you invoke each time" and instead be a
runtime any host can drive. The runtime core (`@flow/core`) is usable directly and via the
`flow` CLI, but neither is reachable by a generic AI host.

## Decision
Add `@flow/mcp-server`: a Model Context Protocol server exposing the runtime as a small set of
high-level `flow_*` tools. The tool logic lives in `tools.ts` (plain handlers over a
`Runtime`), independent of the SDK; `server.ts` only maps the protocol's list/call requests
onto those handlers. Transport is stdio for now (bin `flow-mcp`, compose service `mcp`).

Tools exposed: `flow_start`, `flow_add_task`, `flow_plan`, `flow_ready`, `flow_set`,
`flow_advance`, `flow_gate`, `flow_budget`, `flow_status`, `flow_report`. Runs are isolated
under `<FLOW_HOME>/runs/<runId>/`.

## Rationale
- **High-level, not raw mutations.** We expose intent-level tools, not `write_arbitrary_state`.
  Per the plan (§33), dangerous internal mutations stay off the MCP surface.
- **Core stays MCP-free.** `@flow/core` imports no SDK; MCP is a boundary package. The runtime
  remains usable from a CLI, a daemon, or CI without MCP.
- **Testable without processes.** Handlers are unit-tested directly; the full protocol path is
  tested with the SDK's in-memory transport, and a stdio smoke test proves the container.

## Consequences
- Error results use `isError: true` content rather than thrown exceptions, per MCP convention.
- Only stdio is implemented; a network (HTTP) transport, auth, and a standing `docker compose
  up` daemon are deferred to remote deployment.
- The tool names/inputs are now an interface; changing them is a breaking change for hosts.
