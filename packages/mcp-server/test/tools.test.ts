import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FakeProvider, ModelRouter } from "@flow/llm";
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

  it("flow_spec runs the planner and returns the parsed plan", async () => {
    const planJson = JSON.stringify({
      spec: { objective: "Build X", requirements: [], acceptance: ["works"] },
      approach: "",
      tasks: [{ id: "t1", role: "backend", tier: "sonnet", deps: [], instruction: "do it" }],
    });
    const router = { async complete() { return { text: planJson }; } } as unknown as ModelRouter;
    const res = (await getTool("flow_spec").handler({ baseDir: ctx.baseDir, router }, { objective: "Build X" })) as { spec: { objective: string }; tasks: unknown[] };
    expect(res.spec.objective).toBe("Build X");
    expect(res.tasks).toHaveLength(1);
  });

  it("flow_converge reports done vs pending", () => {
    const plan = {
      spec: { objective: "O", requirements: [], acceptance: [], clarifications: [] },
      approach: "",
      tasks: [
        { id: "t1", role: "backend", tier: "sonnet", deps: [], instruction: "" },
        { id: "t2", role: "backend", tier: "sonnet", deps: [], instruction: "" },
      ],
    };
    const res = getTool("flow_converge").handler(ctx, { plan, outcomes: { t1: "green", t2: "blocked" } }) as { done: string[]; pending: string[]; complete: boolean; summary: string };
    expect(res.done).toEqual(["t1"]);
    expect(res.pending).toEqual(["t2"]);
    expect(res.complete).toBe(false);
    expect(res.summary).toContain("1/2 green");
  });

  it("flow_qa runs the QA engine and returns a report with tickets", () => {
    const target = mkdtempSync(join(tmpdir(), "flow-qa-mcp-target-"));
    const evidenceDir = mkdtempSync(join(tmpdir(), "flow-qa-mcp-ev-"));
    try {
      const res = getTool("flow_qa").handler(ctx, {
        target,
        evidenceDir,
        criteria: [
          { id: "ok", description: "passes", verify: ["node", "-e", "process.exit(0)"] },
          { id: "bad", description: "fails", verify: ["node", "-e", "process.exit(1)"], severity: "critical" },
        ],
      }) as { complete: boolean; summary: string; criteria: Array<{ id: string; status: string; tickets: unknown[] }> };
      expect(res.complete).toBe(false);
      expect(res.summary).toBe("1/2 pass");
      expect(res.criteria.find((c) => c.id === "bad")?.tickets).toHaveLength(1);
    } finally {
      rmSync(target, { recursive: true, force: true });
      rmSync(evidenceDir, { recursive: true, force: true });
    }
  });

  it("flow_run runs the loop and returns a report (the CEO completes immediately)", async () => {
    const targetDir = mkdtempSync(join(tmpdir(), "flow-mcp-run-"));
    const provider = new FakeProvider({ responder: () => JSON.stringify({ action: "complete", taskIds: [], newTasks: [], reason: "done", confidence: 1 }) });
    const router = new ModelRouter(new Map([[provider.name, provider]]), [{ tier: "opus", provider: provider.name, model: "m" }], "opus");
    try {
      const res = (await getTool("flow_run").handler({ baseDir: ctx.baseDir, router }, {
        runId: "mcp-run-1",
        targetDir,
        tasks: [{ id: "a", role: "backend", tier: "sonnet", deps: [], instruction: "do a" }],
      })) as { completed: boolean; runId: string };
      expect(res.completed).toBe(true);
      expect(res.runId).toBe("mcp-run-1");
    } finally {
      rmSync(targetDir, { recursive: true, force: true });
    }
  });

  describe("flow_execute", () => {
    let targetDir: string;
    let router: ModelRouter;

    beforeEach(() => {
      targetDir = mkdtempSync(join(tmpdir(), "flow-mcp-target-"));
      const provider = new FakeProvider({ responder: () => "<<<FILE out.txt>>>\nhi\n<<<END>>>\n<<<REASON>>> ok" });
      router = new ModelRouter(new Map([[provider.name, provider]]), [{ tier: "sonnet", provider: provider.name, model: "m" }], "sonnet");
      ctx = { baseDir: ctx.baseDir, router };
    });
    afterEach(() => {
      rmSync(targetDir, { recursive: true, force: true });
    });

    it("executes a task and sets it green", async () => {
      call("flow_start", { runId: "exec1", objective: "o" });
      call("flow_add_task", { runId: "exec1", id: "t", role: "backend", tier: "sonnet" });

      const result = (await getTool("flow_execute").handler(ctx, {
        runId: "exec1",
        taskId: "t",
        instruction: "make out.txt",
        targetDir,
      })) as { status: string; files: string[]; verify: { ran: boolean; ok: boolean } };

      expect(result.status).toBe("green");
      expect(result.files).toEqual(["out.txt"]);
      expect(result.verify).toEqual({ ran: false, ok: true, output: "" });
      expect(existsSync(join(targetDir, "out.txt"))).toBe(true);
      expect(readFileSync(join(targetDir, "out.txt"), "utf8")).toBe("hi");

      const status = call("flow_status", { runId: "exec1" }) as { plans: Array<{ id: string; status: string }> };
      expect(status.plans.find((p) => p.id === "t")?.status).toBe("green");
    });

    it("blocks the task when verify fails", async () => {
      call("flow_start", { runId: "exec2", objective: "o" });
      call("flow_add_task", { runId: "exec2", id: "t", role: "backend", tier: "sonnet" });

      const result = (await getTool("flow_execute").handler(ctx, {
        runId: "exec2",
        taskId: "t",
        instruction: "make out.txt",
        targetDir,
        verifyCommand: ["node", "-e", "process.exit(1)"],
      })) as { status: string; verify: { ok: boolean } };

      expect(result.status).toBe("blocked");
      expect(result.verify.ok).toBe(false);
    });
  });
});
