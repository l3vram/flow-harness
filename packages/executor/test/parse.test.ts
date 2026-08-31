import { describe, expect, it } from "vitest";
import { isSafeRelativePath, parseChanges } from "../src/index.js";

describe("parseChanges", () => {
  it("parses a valid response", () => {
    const text = JSON.stringify({
      files: [{ path: "a.ts", content: "hello" }],
      reason: "did it",
    });
    const { files, reason } = parseChanges(text);
    expect(files).toEqual([{ path: "a.ts", content: "hello" }]);
    expect(reason).toBe("did it");
  });

  it("parses JSON embedded in surrounding prose", () => {
    const text = `Sure, here you go:\n${JSON.stringify({
      files: [{ path: "a.ts", content: "hi" }],
      reason: "ok",
    })}\nHope that helps!`;
    const { files } = parseChanges(text);
    expect(files).toEqual([{ path: "a.ts", content: "hi" }]);
  });

  it("defaults reason to empty string when missing", () => {
    const text = JSON.stringify({ files: [] });
    const { reason } = parseChanges(text);
    expect(reason).toBe("");
  });

  it("throws on non-JSON text", () => {
    expect(() => parseChanges("no braces here")).toThrow("executor returned no parseable JSON");
  });

  it("throws when files is missing", () => {
    expect(() => parseChanges(JSON.stringify({ reason: "x" }))).toThrow(
      "executor JSON missing files array",
    );
  });

  it("throws when files is not an array", () => {
    expect(() => parseChanges(JSON.stringify({ files: "nope" }))).toThrow(
      "executor JSON missing files array",
    );
  });

  it("throws when exceeding maxFiles", () => {
    const files = [{ path: "a.ts", content: "x" }, { path: "b.ts", content: "y" }];
    expect(() => parseChanges(JSON.stringify({ files }), 1)).toThrow("too many files (2 > 1)");
  });

  it("throws on a non-string path", () => {
    const text = JSON.stringify({ files: [{ path: 5, content: "x" }] });
    expect(() => parseChanges(text)).toThrow();
  });

  it("throws on a non-string content", () => {
    const text = JSON.stringify({ files: [{ path: "a.ts", content: 5 }] });
    expect(() => parseChanges(text)).toThrow();
  });

  it("throws on an unsafe path", () => {
    const text = JSON.stringify({ files: [{ path: "../escape.txt", content: "x" }] });
    expect(() => parseChanges(text)).toThrow("unsafe path: ../escape.txt");
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
