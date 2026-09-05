import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FakeProvider, ModelRouter } from "@flow/llm";
import { runFromConfig, type RunConfig } from "../src/index.js";

function ceoCompleteRouter(): ModelRouter {
  const provider = new FakeProvider({ responder: () => JSON.stringify({ action: "complete", taskIds: [], newTasks: [], reason: "done", confidence: 1 }) });
  return new ModelRouter(new Map([[provider.name, provider]]), [{ tier: "opus", provider: provider.name, model: "m" }], "opus");
}

function plannerRouter(): ModelRouter {
  const plan = JSON.stringify({ spec: { objective: "X", requirements: [], acceptance: [] }, approach: "", tasks: [{ id: "t1", role: "backend", tier: "sonnet", deps: [], instruction: "do t1" }] });
  const provider = new FakeProvider({ responder: () => plan });
  return new ModelRouter(new Map([[provider.name, provider]]), [{ tier: "opus", provider: provider.name, model: "m" }], "opus");
}

describe("runFromConfig", () => {
  let baseDir: string;
  let targetDir: string;
  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), "flow-run-base-"));
    targetDir = mkdtempSync(join(tmpdir(), "flow-run-target-"));
  });
  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
    rmSync(targetDir, { recursive: true, force: true });
  });

  it("runs explicit tasks and returns the report (the CEO completes immediately)", async () => {
    const config: RunConfig = {
      runId: "r1",
      objective: "o",
      targetDir,
      tasks: [{ id: "a", role: "backend", tier: "sonnet", deps: [], instruction: "do a" }],
    };
    const report = await runFromConfig(config, { router: ceoCompleteRouter(), baseDir });
    expect(report.completed).toBe(true);
    expect(report.runId).toBe("r1");
  });

  it("throws 'plan pending' for an objective without acceptPlan", async () => {
    const config: RunConfig = { runId: "r2", objective: "build X", targetDir };
    await expect(runFromConfig(config, { router: plannerRouter(), baseDir })).rejects.toThrow(/plan pending/);
  });
});
