import { describe, expect, it } from "vitest";
import { getTool, SERVER_INSTRUCTIONS } from "../src/index.js";

// The MCP server must hand the host everything needed to drive flow_run without the user
// hand-writing parameters: a `worktree` option on the tool, and server-level instructions that
// document the workflow (targetDir, review-first, Gradle verifyCommand, worktree isolation).

describe("flow_run host guidance", () => {
  it("flow_run exposes a worktree option in its schema", () => {
    const t = getTool("flow_run");
    const props = (t.inputSchema as { properties: Record<string, unknown> }).properties;
    expect(props.worktree).toBeDefined();
  });

  it("flow_run description points the host at verifyCommand and worktree", () => {
    const t = getTool("flow_run");
    expect(t.description).toMatch(/verifyCommand/);
    expect(t.description).toMatch(/worktree/);
  });

  it("server instructions tell the host how to drive a feature-add", () => {
    expect(SERVER_INSTRUCTIONS).toMatch(/flow_run/);
    expect(SERVER_INSTRUCTIONS).toMatch(/targetDir/);
    expect(SERVER_INSTRUCTIONS).toMatch(/verifyCommand/);
    expect(SERVER_INSTRUCTIONS).toMatch(/worktree/);
    expect(SERVER_INSTRUCTIONS).toMatch(/acceptPlan/);
  });
});
