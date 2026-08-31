import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyChanges } from "../src/index.js";

describe("applyChanges", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "flow-executor-apply-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes nested files into the target dir and returns their paths", () => {
    const files = [
      { path: "a.txt", content: "hello" },
      { path: "nested/dir/b.txt", content: "world" },
    ];
    const written = applyChanges(dir, files);
    expect(written).toEqual(["a.txt", "nested/dir/b.txt"]);
    expect(readFileSync(join(dir, "a.txt"), "utf8")).toBe("hello");
    expect(readFileSync(join(dir, "nested/dir/b.txt"), "utf8")).toBe("world");
  });

  it("throws for a path that resolves outside the target dir", () => {
    const files = [{ path: "../escape.txt", content: "bad" }];
    expect(() => applyChanges(dir, files)).toThrow("path escapes target: ../escape.txt");
  });
});
