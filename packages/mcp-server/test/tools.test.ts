import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getTool, type ToolContext } from "../src/index.js";

describe("mcp tool handlers", () => {
  let ctx: ToolContext;
  beforeEach(() => {
    ctx = { baseDir: mkdtempSync(join(tmpdir(), "flow-mcp-")) };
  });
  afterEach(() => {
    rmSync(ctx.baseDir, { recursive: true, force: true });
  });

  const call = (name: string, args: Record<string, unknown>): unknown => getTool(name).handler(ctx, args);

  it("drives a run: start → add → plan → ready → set → status", () => {
    call("flow_start", { runId: "r1", objective: "o" });
    call("flow_add_task", { runId: "r1", id: "a", role: "backend", tier: "sonnet" });
    call("flow_add_task", { runId: "r1", id: "b", role: "frontend", tier: "haiku", deps: ["a"] });

    expect(call("flow_plan", { runId: "r1" })).toEqual({ waves: [["a"], ["b"]], cycle: [] });
    expect(call("flow_ready", { runId: "r1" })).toEqual({ ready: ["a"] });

    call("flow_set", { runId: "r1", id: "a", status: "green" });
    const status = call("flow_status", { runId: "r1" }) as { plans: Array<{ id: string; status: string }> };
    expect(status.plans.find((p) => p.id === "a")?.status).toBe("green");
  });

  it("persists across separate handler calls (own event log per run)", () => {
    call("flow_start", { runId: "r2" });
    call("flow_add_task", { runId: "r2", id: "x", role: "data", tier: "haiku" });
    const status = call("flow_status", { runId: "r2" }) as { plans: unknown[] };
    expect(status.plans).toHaveLength(1);
  });

  it("rejects a duplicate start", () => {
    call("flow_start", { runId: "dup" });
    expect(() => call("flow_start", { runId: "dup" })).toThrow(/already exists/);
  });

  it("rejects an invalid status", () => {
    call("flow_start", { runId: "r3" });
    call("flow_add_task", { runId: "r3", id: "a", role: "x", tier: "haiku" });
    expect(() => call("flow_set", { runId: "r3", id: "a", status: "bogus" })).toThrow(/invalid status/);
  });

  it("rejects acting on an unknown run", () => {
    expect(() => call("flow_ready", { runId: "ghost" })).toThrow(/run not found/);
  });
});
