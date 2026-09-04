import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
    const changes = [
      { kind: "write" as const, path: "a.txt", content: "hello" },
      { kind: "write" as const, path: "nested/dir/b.txt", content: "world" },
    ];
    const written = applyChanges(dir, changes);
    expect(written).toEqual(["a.txt", "nested/dir/b.txt"]);
    expect(readFileSync(join(dir, "a.txt"), "utf8")).toBe("hello");
    expect(readFileSync(join(dir, "nested/dir/b.txt"), "utf8")).toBe("world");
  });

  it("throws for a write path that resolves outside the target dir", () => {
    const changes = [{ kind: "write" as const, path: "../escape.txt", content: "bad" }];
    expect(() => applyChanges(dir, changes)).toThrow("path escapes target: ../escape.txt");
  });

  it("edits a file whose search text matches exactly once", () => {
    writeFileSync(join(dir, "a.txt"), "before: X\nunrelated line", "utf8");
    const changes = [
      { kind: "edit" as const, path: "a.txt", search: "before: X", replace: "after: Y" },
    ];
    const written = applyChanges(dir, changes);
    expect(written).toEqual(["a.txt"]);
    expect(readFileSync(join(dir, "a.txt"), "utf8")).toBe("after: Y\nunrelated line");
  });

  it("throws when editing a file that does not exist", () => {
    const changes = [
      { kind: "edit" as const, path: "missing.txt", search: "x", replace: "y" },
    ];
    expect(() => applyChanges(dir, changes)).toThrow("cannot edit missing file: missing.txt");
  });

  it("throws when the search text is not present", () => {
    writeFileSync(join(dir, "a.txt"), "some content", "utf8");
    const changes = [
      { kind: "edit" as const, path: "a.txt", search: "nope", replace: "y" },
    ];
    expect(() => applyChanges(dir, changes)).toThrow("search text not found in a.txt");
  });

  it("throws when the search text appears more than once", () => {
    writeFileSync(join(dir, "a.txt"), "dup\nother\ndup", "utf8");
    const changes = [
      { kind: "edit" as const, path: "a.txt", search: "dup", replace: "y" },
    ];
    expect(() => applyChanges(dir, changes)).toThrow("search text is not unique in a.txt");
  });

  it("throws for an edit path that resolves outside the target dir", () => {
    const changes = [
      { kind: "edit" as const, path: "../escape.txt", search: "x", replace: "y" },
    ];
    expect(() => applyChanges(dir, changes)).toThrow("path escapes target: ../escape.txt");
  });

  it("is atomic: when a later change in the batch fails, none of the batch is written", () => {
    // A valid write followed by an edit of a missing file: the batch must be rejected as a whole,
    // and the valid write must NOT have landed on disk.
    const changes = [
      { kind: "write" as const, path: "new.txt", content: "hello" },
      { kind: "edit" as const, path: "missing.txt", search: "x", replace: "y" },
    ];
    expect(() => applyChanges(dir, changes)).toThrow("cannot edit missing file: missing.txt");
    expect(existsSync(join(dir, "new.txt"))).toBe(false);
  });

  it("applies multiple edits to the same file in order", () => {
    writeFileSync(join(dir, "a.txt"), "one two", "utf8");
    const changes = [
      { kind: "edit" as const, path: "a.txt", search: "one", replace: "1" },
      { kind: "edit" as const, path: "a.txt", search: "two", replace: "2" },
    ];
    const written = applyChanges(dir, changes);
    expect(written).toEqual(["a.txt"]);
    expect(readFileSync(join(dir, "a.txt"), "utf8")).toBe("1 2");
  });
});
