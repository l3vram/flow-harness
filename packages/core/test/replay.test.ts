import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Runtime } from "../src/index.js";

describe("replay / resumability", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "flow-replay-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("rebuilds identical state after the projection cache is deleted", () => {
    const rt = Runtime.init(dir, "r", "obj");
    rt.addTask("a", "backend", "sonnet", []);
    rt.addTask("b", "frontend", "haiku", ["a"]);
    rt.setStatus("a", "running");
    rt.setStatus("a", "green");
    rt.recordGate("A", "approved");
    rt.chargeBudget("a", 250, "sonnet", "exec");
    const before = rt.state;

    // Nuke state.json; only the append-only event log remains.
    const statePath = join(dir, "state.json");
    expect(existsSync(statePath)).toBe(true);
    unlinkSync(statePath);

    // A fresh runtime over the same directory reproduces the exact state from the log.
    const resumed = new Runtime(dir).state;
    expect(resumed).toEqual(before);
  });

  it("keeps state.json equal to the projection of the log", () => {
    const rt = Runtime.init(dir, "r", "obj");
    rt.addTask("a", "backend", "sonnet", []);
    rt.setStatus("a", "running");
    const cached = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
    expect(cached).toEqual(rt.state);
  });
});
