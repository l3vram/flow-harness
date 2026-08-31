import { expect, it } from "vitest";
import { searchLessons } from "../src/search.js";
import type { Lesson } from "../src/types.js";

const lessons: Lesson[] = [
  {
    id: "a",
    scope: "global",
    content: "The quick brown fox",
    tags: ["animal", "speed"],
    createdAt: "2023-01-01T00:00:00Z",
  },
  {
    id: "b",
    scope: "global",
    content: "Lazy dog sleeps",
    tags: ["animal"],
    createdAt: "2023-01-02T00:00:00Z",
  },
  {
    id: "c",
    scope: "global",
    content: "Jumping over the lazy dog",
    tags: ["action"],
    createdAt: "2023-01-03T00:00:00Z",
  },
];

it("ranks lesson matching query first and respects k limit", () => {
  const results = searchLessons(lessons, "quick fox animal", 2);
  // "quick" and "fox" appear only in lesson a, animal appears in a and b.
  // Scores: a = 2 (quick, fox) + 1 (animal) = 3, b = 1 (animal) = 1, c = 0.
  expect(results.map((l) => l.id)).toEqual(["a", "b"]);
});

it("returns empty array when no terms match", () => {
  const results = searchLessons(lessons, "unrelatedterm", 5);
  expect(results).toEqual([]);
});