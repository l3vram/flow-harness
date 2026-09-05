import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Runtime } from "@flow/core";
import { buildDecisionMessages } from "../src/prompt.js";

describe("repair->replan prompt", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "flow-replan-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("surfaces a blocked task's reason (diagnosis) in the CEO snapshot", () => {
    const rt = Runtime.init(dir, "r", "obj");
    rt.addTask("a", "backend", "sonnet", []);
    rt.setStatus("a", "blocked", "verify failed: cannot resolve module X");
    const messages = buildDecisionMessages(rt.state, [], "");
    const userMsg = messages.find((m) => m.role === "user");
    expect(userMsg?.content).toContain("verify failed: cannot resolve module X");
  });

  it("the system prompt tells the CEO to replan (add_task) on a blocked task", () => {
    const rt = Runtime.init(dir, "r", "obj");
    const messages = buildDecisionMessages(rt.state, [], "");
    const sys = messages.find((m) => m.role === "system");
    expect(sys?.content).toContain("blocked");
    expect(sys?.content).toContain("add_task");
  });
});
