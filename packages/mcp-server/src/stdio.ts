#!/usr/bin/env node
import { main } from "./server.js";
import { doctorMain, flowVersion } from "./doctor.js";

const arg = process.argv[2];

if (arg === "doctor") {
  process.exit(doctorMain());
} else if (arg === "--version" || arg === "-v") {
  process.stdout.write(flowVersion() + "\n");
  process.exit(0);
} else if (arg === "--help" || arg === "-h") {
  process.stdout.write(
    [
      "flow-mcp — the flow-harness MCP server (stdio)",
      "",
      "Usage:",
      "  flow-mcp              start the MCP stdio server (default)",
      "  flow-mcp doctor       run a self-diagnostic and exit (non-zero on failure)",
      "  flow-mcp --version    print the version",
      "  flow-mcp --help       show this help",
      "",
    ].join("\n"),
  );
  process.exit(0);
} else {
  main().catch((error) => {
    process.stderr.write(String(error instanceof Error ? error.stack ?? error.message : error) + "\n");
    process.exit(1);
  });
}