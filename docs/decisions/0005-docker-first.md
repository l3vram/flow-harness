# ADR 0005 — Docker-first, local and remote

**Status:** accepted · 2026-08-30

## Context
The harness will "almost always" be run through Docker, both locally and remotely, to avoid
installing toolchains on the host and to guarantee the local and remote environments match.

## Decision
- A multi-stage `Dockerfile` (`node:22-alpine`): a `build` stage installs workspace deps with
  `npm ci` **and the source present**, then `tsc -b`; a `test` stage runs the suite; a
  `runtime` stage ships only what the `flow` CLI needs and reads/writes run state under `/work`.
- `docker-compose.yml` exposes three services: `test` (one-shot suite), `flow` (the CLI, with
  run state on the named volume `flow-state:/work`), and `dev` (source-mounted watch mode).
- Everything is installed and compiled **inside** the container, so the host stays clean and
  the musl/linux binaries (e.g. esbuild) are the right ones.

## Gotchas learned (so they don't bite again)
- **Install with the source present.** Running `npm ci` in a stage that only has the package
  manifests, then copying source in a later stage, left `tsc` unable to resolve `@flow/core`.
  Copying the full source before `npm ci` (mirroring the local order) fixed it.
- **Exclude nested `*.tsbuildinfo` from the build context.** `.dockerignore` excluded `dist`
  and root-level `*.tsbuildinfo`, but not `packages/*/tsconfig.tsbuildinfo`. Stale buildinfo
  from a host build leaked in, so `tsc -b` believed everything was current and emitted **no**
  `dist`. The fix is a `**/*.tsbuildinfo` pattern; the lesson is to keep all host build
  artifacts out of the image context.

## Consequences
- `docker compose run --rm flow …` is the canonical way to drive a run; the volume persists
  state across the (separate) containers.
- There is no `docker compose up` daemon yet — v0.1 is a CLI, not a server. The MCP server
  (v0.4) will add a long-running service and a real `up` target.
