import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Parity is the acceptance test: the built `flow` binary must reproduce flow.sh's command
// surface and output shape. We drive the real binary in a scratch directory so the event
// log and projection cache are exercised end to end.

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "cli.js");

interface RunResult {
  stdout: string;
  stderr: string;
  status: number;
}

describe("flow CLI parity with flow.sh", () => {
  let dir: string;

  const run = (...args: string[]): RunResult => {
    try {
      const stdout = execFileSync(process.execPath, [CLI, ...args], { cwd: dir, encoding: "utf8" });
      return { stdout, stderr: "", status: 0 };
    } catch (e) {
      const err = e as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number };
      return {
        stdout: (err.stdout ?? "").toString(),
        stderr: (err.stderr ?? "").toString(),
        status: err.status ?? 1,
      };
    }
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "flow-cli-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("runs the happy path: init → add → waves → ready → set → advance", () => {
    expect(run("init", "r1", "build a thing").stdout.trim()).toBe(`init ${join(".flow", "state.json")}`);
    expect(run("add", "a", "backend", "sonnet").stdout.trim()).toBe("add a (backend/sonnet) deps=[]");
    expect(run("add", "b", "frontend", "haiku", "a").stdout.trim()).toBe("add b (frontend/haiku) deps=[a]");

    const waves = run("waves");
    expect(waves.stdout).toContain("wave 1: a");
    expect(waves.stdout).toContain("wave 2: b");
    expect(waves.stdout).toContain("(2 waves)");

    expect(run("ready").stdout.trim()).toBe("a");
    expect(run("set", "a", "running").stdout.trim()).toBe("set a -> running");
    expect(run("set", "a", "green").stdout.trim()).toBe("set a -> green");
    expect(run("wave-done").status).toBe(0);
    expect(run("advance").stdout.trim()).toBe("advanced to wave 2/2");
    expect(run("ready").stdout.trim()).toBe("b");
  });

  it("detects a dependency cycle, exits 2, and names the culprits", () => {
    run("init", "r2", "x");
    run("add", "a", "backend", "sonnet", "b");
    run("add", "b", "frontend", "haiku", "a");
    const res = run("waves");
    expect(res.status).toBe(2);
    expect(res.stderr).toContain("CYCLE in dependency graph involving: a, b");
  });

  it("trips the circuit breaker after three runs", () => {
    run("init", "r3", "x");
    run("add", "a", "backend", "sonnet");
    run("set", "a", "running");
    run("set", "a", "running");
    const res = run("set", "a", "running");
    expect(res.stdout).toContain("CIRCUIT BREAKER at 3 attempts");
    expect(run("panel").stdout).toContain("BLOCKED");
  });

  it("refuses to advance across an unfinished wave (barrier)", () => {
    run("init", "r4", "x");
    run("add", "a", "backend", "sonnet");
    run("add", "b", "frontend", "haiku");
    run("set", "a", "green");
    const res = run("advance");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("barrier: current wave not complete");
  });

  it("errors when a command runs before init", () => {
    const res = run("ready");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("run 'flow init' first");
  });

  it("records the ledger and renders a report", () => {
    run("init", "r5", "x");
    run("add", "a", "backend", "sonnet");
    expect(run("budget", "a", "1200", "sonnet", "exec").stdout.trim()).toBe("budget +1200 (sonnet/exec) -> a");
    const report = run("report").stdout;
    expect(report).toContain("TOKEN LEDGER — run r5");
    expect(report).toContain("a: 1200");
    expect(report).toContain("spawns: 1");
  });
});
