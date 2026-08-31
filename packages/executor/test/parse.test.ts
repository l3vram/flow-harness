import { describe, expect, it } from "vitest";
import { isSafeRelativePath, parseChanges } from "../src/index.js";

describe("parseChanges", () => {
  it("parses a single block into one FileChange with exact content", () => {
    const text = "<<<FILE a.ts>>>\nhello\n<<<END>>>";
    const { files, reason } = parseChanges(text);
    expect(files).toEqual([{ path: "a.ts", content: "hello" }]);
    expect(reason).toBe("");
  });

  it("parses two blocks where content spans multiple lines with braces, quotes and a blank line", () => {
    const contentA = [
      "function f() {",
      '  const s = "hi \'there\'";',
      "",
      "  return s;",
      "}",
    ].join("\n");
    const contentB = "just some text\nwith another line";
    const text = [
      "<<<FILE src/a.ts>>>",
      contentA,
      "<<<END>>>",
      "<<<FILE src/b.txt>>>",
      contentB,
      "<<<END>>>",
      "<<<REASON>>> wrote two files",
    ].join("\n");

    const { files, reason } = parseChanges(text);
    expect(files).toEqual([
      { path: "src/a.ts", content: contentA },
      { path: "src/b.txt", content: contentB },
    ]);
    expect(reason).toBe("wrote two files");
  });

  it("extracts <<<REASON>>> ...", () => {
    const text = "<<<FILE a.ts>>>\nx\n<<<END>>>\n<<<REASON>>> did it";
    const { reason } = parseChanges(text);
    expect(reason).toBe("did it");
  });

  it("defaults reason to empty string when absent", () => {
    const text = "<<<FILE a.ts>>>\nx\n<<<END>>>";
    const { reason } = parseChanges(text);
    expect(reason).toBe("");
  });

  it("throws no file blocks when the text has none", () => {
    expect(() => parseChanges("no markers here")).toThrow("executor returned no file blocks");
  });

  it("throws on an unsafe path", () => {
    const text = "<<<FILE ../evil.txt>>>\nx\n<<<END>>>";
    expect(() => parseChanges(text)).toThrow("unsafe path: ../evil.txt");
  });

  it("throws when block count exceeds maxFiles", () => {
    const text = "<<<FILE a.ts>>>\nx\n<<<END>>>\n<<<FILE b.ts>>>\ny\n<<<END>>>";
    expect(() => parseChanges(text, 1)).toThrow("too many files (2 > 1)");
  });
});

describe("isSafeRelativePath", () => {
  it("accepts a normal relative path", () => {
    expect(isSafeRelativePath("a/b.ts")).toBe(true);
  });

  it("rejects a leading slash", () => {
    expect(isSafeRelativePath("/abs")).toBe(false);
  });

  it("rejects a leading ..", () => {
    expect(isSafeRelativePath("../x")).toBe(false);
  });

  it("rejects an embedded .. segment", () => {
    expect(isSafeRelativePath("a/../b")).toBe(false);
  });

  it("rejects a backslash", () => {
    expect(isSafeRelativePath("a\\b")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isSafeRelativePath("")).toBe(false);
  });
});
