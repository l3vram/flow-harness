import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { indexProject } from "../src/indexer.js";

describe("indexProject", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "flow-context-indexer-"));
    writeFileSync(join(root, "a.ts"), "export const a = 1;\n");
    mkdirSync(join(root, "sub"));
    writeFileSync(join(root, "sub", "b.ts"), "export const b = 2;\n");
    mkdirSync(join(root, "node_modules"));
    writeFileSync(join(root, "node_modules", "x.js"), "module.exports = {};\n");
    writeFileSync(join(root, "big.txt"), "x".repeat(1000));
    writeFileSync(join(root, "bin.dat"), Buffer.from([0x41, 0x00, 0x42]));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("indexes only allowed, non-binary, in-budget files, sorted by path", () => {
    const entries = indexProject(root, { maxFileBytes: 100 });

    expect(entries.map((entry) => entry.path)).toEqual(["a.ts", "sub/b.ts"]);
    expect(entries[0]?.content).toBe("export const a = 1;\n");
    expect(entries[1]?.content).toBe("export const b = 2;\n");
  });
});
