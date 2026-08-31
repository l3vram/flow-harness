import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { MemoryStore } from "../src/store.js";
import type { Lesson } from "../src/types.js";

it("adds lessons and retrieves them in order", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "memory-test-"));
  const filePath = join(tempDir, "lessons.jsonl");
  const store = new MemoryStore(filePath);

  const lesson1: Lesson = {
    id: "1",
    scope: "global",
    content: "First lesson content",
    tags: ["tag1"],
    createdAt: "2023-01-01T00:00:00Z",
  };
  const lesson2: Lesson = {
    id: "2",
    scope: "global",
    content: "Second lesson content",
    tags: ["tag2"],
    createdAt: "2023-01-02T00:00:00Z",
  };

  store.add(lesson1);
  store.add(lesson2);

  const all = store.all();
  expect(all).toEqual([lesson1, lesson2]);

  // cleanup
  rmSync(tempDir, { recursive: true, force: true });
});

it("returns empty array when file does not exist", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "memory-test-"));
  const filePath = join(tempDir, "nonexistent.jsonl");
  const store = new MemoryStore(filePath);
  const all = store.all();
  expect(all).toEqual([]);
  rmSync(tempDir, { recursive: true, force: true });
});