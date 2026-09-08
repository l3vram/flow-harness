import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveConventions, type RunConfig } from "../src/index.js";

function cfg(targetDir: string, conventions?: string): RunConfig {
  return { runId: "r", objective: "o", targetDir, conventions };
}

describe("resolveConventions", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "flow-conv-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("explicit config.conventions wins over any file", () => {
    writeFileSync(join(dir, "AGENTS.md"), "from file");
    expect(resolveConventions(cfg(dir, "explicit rules"))).toBe("explicit rules");
  });

  it("auto-reads AGENTS.md when no explicit conventions", () => {
    writeFileSync(join(dir, "AGENTS.md"), "no Hilt");
    expect(resolveConventions(cfg(dir))).toBe("no Hilt");
  });

  it("falls back to CONVENTIONS.md", () => {
    writeFileSync(join(dir, "CONVENTIONS.md"), "junit4 only");
    expect(resolveConventions(cfg(dir))).toBe("junit4 only");
  });

  it("returns empty string when neither file exists", () => {
    expect(resolveConventions(cfg(dir))).toBe("");
  });

  it("an explicit empty string opts out even if AGENTS.md exists", () => {
    writeFileSync(join(dir, "AGENTS.md"), "from file");
    expect(resolveConventions(cfg(dir, ""))).toBe("");
  });
});
