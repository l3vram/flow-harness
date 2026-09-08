import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FakeProvider, ModelRouter } from "@flow/llm";
import { runFromConfig, type RunConfig } from "../src/index.js";

// A router whose CEO immediately completes — no task runs, but the worktree is still created.
function ceoCompleteRouter(): ModelRouter {
  const provider = new FakeProvider({
    responder: () => JSON.stringify({ action: "complete", taskIds: [], newTasks: [], reason: "done", confidence: 1 }),
  });
  return new ModelRouter(new Map([[provider.name, provider]]), [{ tier: "opus", provider: provider.name, model: "m" }], "opus");
}

function initGitRepo(dir: string): void {
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "t@t"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "t"], { cwd: dir });
  execFileSync("git", ["commit", "--allow-empty", "-q", "-m", "init"], { cwd: dir });
}

describe("runFromConfig worktree isolation", () => {
  let baseDir: string;
  let targetDir: string;
  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), "flow-wt-base-"));
    targetDir = mkdtempSync(join(tmpdir(), "flow-wt-target-"));
  });
  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
    rmSync(targetDir, { recursive: true, force: true });
  });

  it("worktree:true on a git repo runs on flow/<runId> and surfaces branch + worktreeDir", async () => {
    initGitRepo(targetDir);
    const config: RunConfig = {
      runId: "wt1",
      objective: "o",
      targetDir,
      worktree: true,
      tasks: [{ id: "a", role: "backend", tier: "sonnet", deps: [], instruction: "do a" }],
    };
    const report = await runFromConfig(config, { router: ceoCompleteRouter(), baseDir });
    expect(report.branch).toBe("flow/wt1");
    expect(report.worktreeDir).toBeDefined();
    expect(existsSync(report.worktreeDir as string)).toBe(true);
    const branches = execFileSync("git", ["branch", "--list", "flow/wt1"], { cwd: targetDir }).toString();
    expect(branches).toContain("flow/wt1");
  });

  it("without worktree, no branch is set (writes into targetDir directly)", async () => {
    const config: RunConfig = {
      runId: "wt2",
      objective: "o",
      targetDir,
      tasks: [{ id: "a", role: "backend", tier: "sonnet", deps: [], instruction: "do a" }],
    };
    const report = await runFromConfig(config, { router: ceoCompleteRouter(), baseDir });
    expect(report.branch).toBeUndefined();
    expect(report.worktreeDir).toBeUndefined();
  });
});