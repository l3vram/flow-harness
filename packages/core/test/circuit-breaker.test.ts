import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Runtime } from "../src/index.js";

describe("circuit breaker", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "flow-cb-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("forces blocked on the third run without going green", () => {
    const rt = Runtime.init(dir, "r", "o");
    rt.addTask("a", "backend", "sonnet", []);
    rt.setStatus("a", "running");
    rt.setStatus("a", "running");
    const res = rt.setStatus("a", "running");

    expect(res.breaker).toBe(true);
    expect(res.attempts).toBe(3);

    const a = rt.state.plans.find((p) => p.id === "a");
    expect(a?.status).toBe("blocked");
    expect(a?.attempts).toBe(3);
    expect(a?.reason).toContain("[circuit breaker: 3 attempts]");
  });

  it("never overrides a green result", () => {
    const rt = Runtime.init(dir, "r", "o");
    rt.addTask("a", "backend", "sonnet", []);
    rt.setStatus("a", "running");
    rt.setStatus("a", "running");
    const res = rt.setStatus("a", "green");

    expect(res.breaker).toBe(false);
    expect(rt.state.plans[0]?.status).toBe("green");
  });
});
