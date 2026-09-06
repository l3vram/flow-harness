#!/usr/bin/env bash
# One-command install: register the flow-harness MCP server in opencode — no hand-editing JSON.
# Merges a "flow" entry into your opencode config (keeps everything else). Then reload opencode and
# just talk to it: "use flow to add <feature> to my app at <path>".
#
#   ./scripts/install-opencode-mcp.sh              # writes to ~/.config/opencode/opencode.json (global)
#   OPENCODE_CONFIG=./opencode.json ./scripts/install-opencode-mcp.sh   # a specific/project config
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
CFG="${OPENCODE_CONFIG:-$HOME/.config/opencode/opencode.json}"
mkdir -p "$(dirname "$CFG")"
python3 - "$CFG" "$REPO" <<'PY'
import json, os, sys
cfg_path, repo = sys.argv[1], sys.argv[2]
cfg = {}
if os.path.exists(cfg_path):
    try:
        cfg = json.load(open(cfg_path))
    except Exception:
        print("warning: existing config was not valid JSON; leaving it and only adding flow is unsafe — aborting.")
        raise
cfg.setdefault("$schema", "https://opencode.ai/config.json")
mcp = cfg.setdefault("mcp", {})
mcp["flow"] = {
    "type": "local",
    "command": [os.path.join(repo, "scripts", "flow-mcp.sh")],
    "enabled": True,
    "timeout": 600000,
}
json.dump(cfg, open(cfg_path, "w"), indent=2)
open(cfg_path, "a").write("\n")
print("Registered flow MCP in", cfg_path)
PY
echo "Done. Build first if you haven't (npm install && npm run build), then reload opencode —"
echo "it will list the flow_* tools (incl. flow_run). Now just tell opencode what to build."
