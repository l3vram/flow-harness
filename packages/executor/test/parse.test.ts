import { describe, expect, it } from "vitest";
import { isSafeRelativePath, parseChanges } from "../src/index.js";

describe("parseChanges", () => {
  it("parses a single FILE block into one write change with exact content", () => {
    const text = "<<<FILE a.ts>>>\nhello\n<<<END>>>";
    const { changes, reason } = parseChanges(text);
    expect(changes).toEqual([{ kind: "write", path: "a.ts", content: "hello" }]);
    expect(reason).toBe("");
  });

  it("parses two FILE blocks where content spans multiple lines with braces, quotes and a blank line", () => {
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

    const { changes, reason } = parseChanges(text);
    expect(changes).toEqual([
      { kind: "write", path: "src/a.ts", content: contentA },
      { kind: "write", path: "src/b.txt", content: contentB },
    ]);
    expect(reason).toBe("wrote two files");
  });

  it("parses an EDIT block into one edit change with exact search and replace", () => {
    const search = ['function f() {', '  return 1;', "}"].join("\n");
    const replace = ['function f() {', '  return "two";', "}"].join("\n");
    const text = [
      "<<<EDIT src/a.ts>>>",
      "<<<SEARCH>>>",
      search,
      "<<<REPLACE>>>",
      replace,
      "<<<END>>>",
    ].join("\n");

    const { changes, reason } = parseChanges(text);
    expect(changes).toEqual([{ kind: "edit", path: "src/a.ts", search, replace }]);
    expect(reason).toBe("");
  });

  it("parses a mix of one FILE and two EDIT blocks in order", () => {
    const text = [
      "<<<FILE a.ts>>>",
      "content a",
      "<<<END>>>",
      "<<<EDIT b.ts>>>",
      "<<<SEARCH>>>",
      "old1",
      "<<<REPLACE>>>",
      "new1",
      "<<<END>>>",
      "<<<EDIT b.ts>>>",
      "<<<SEARCH>>>",
      "old2",
      "<<<REPLACE>>>",
      "new2",
      "<<<END>>>",
      "<<<REASON>>> mixed changes",
    ].join("\n");

    const { changes, reason } = parseChanges(text);
    expect(changes).toEqual([
      { kind: "write", path: "a.ts", content: "content a" },
      { kind: "edit", path: "b.ts", search: "old1", replace: "new1" },
      { kind: "edit", path: "b.ts", search: "old2", replace: "new2" },
    ]);
    expect(reason).toBe("mixed changes");
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

  it("throws on an unsafe path in a FILE block", () => {
    const text = "<<<FILE ../evil.txt>>>\nx\n<<<END>>>";
    expect(() => parseChanges(text)).toThrow("unsafe path: ../evil.txt");
  });

  it("throws on an unsafe path in an EDIT block", () => {
    const text = "<<<EDIT ../evil.txt>>>\n<<<SEARCH>>>\nold\n<<<REPLACE>>>\nnew\n<<<END>>>";
    expect(() => parseChanges(text)).toThrow("unsafe path: ../evil.txt");
  });

  it("throws on a malformed EDIT block missing REPLACE", () => {
    const text = "<<<EDIT a.ts>>>\n<<<SEARCH>>>\nold\n<<<END>>>";
    expect(() => parseChanges(text)).toThrow("malformed EDIT block for a.ts");
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
