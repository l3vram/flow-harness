#!/usr/bin/env bash
# Launch the flow-harness MCP server (stdio) with provider keys loaded from the repo's .env.
# Point an MCP host (e.g. opencode) at this script as the server "command". Run it locally so the
# machine's toolchains (Android SDK / Gradle, node, etc.) are available to the executor + QA verify.
#
# Prereq: `npm install && npm run build` (builds dist/). Keys live in .env (gitignored).
set -euo pipefail
cd "$(dirname "$0")/.."
# Load FLOW_LLM_* (and anything else) from .env if present, without echoing secrets.
set -a
[ -f .env ] && . ./.env
set +a
# Where run state + evidence live (stable, so a run's artifacts persist and are inspectable).
export FLOW_HOME="${FLOW_HOME:-$(pwd)/.flow}"
exec node packages/mcp-server/dist/stdio.js
