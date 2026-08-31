import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runVerify } from "../src/index.js";

describe("runVerify", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "flow-executor-verify-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns ran:false, ok:true for an empty command", () => {
    const result = runVerify(dir, []);
    expect(result).toEqual({ ran: false, ok: true, output: "" });
  });

  it("returns ok:true for a command that exits 0", () => {
    const result = runVerify(dir, ["node", "-e", "process.exit(0)"]);
    expect(result.ran).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("returns ok:false for a command that exits 1", () => {
    const result = runVerify(dir, ["node", "-e", "process.exit(1)"]);
    expect(result.ran).toBe(true);
    expect(result.ok).toBe(false);
  });

  it("captures output", () => {
    const result = runVerify(dir, ["node", "-e", "console.log('hi')"]);
    expect(result.output).toContain("hi");
  });
});
