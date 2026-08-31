import { describe, expect, it } from "vitest";
import { estimateTokens, scoreEntry, tokenize } from "../src/score.js";
import type { IndexEntry } from "../src/types.js";

describe("estimateTokens", () => {
  it("estimates one token per 4 characters, rounded up", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("")).toBe(0);
  });
});

describe("tokenize", () => {
  it("lowercases, splits on non-alphanumeric runs, and drops short terms", () => {
    expect(tokenize("Circuit-Breaker a")).toEqual(["circuit", "breaker"]);
  });
});

describe("scoreEntry", () => {
  it("weights a path match more than a single content occurrence, and caps content counts", () => {
    const pathMatch: IndexEntry = { path: "circuit-breaker.ts", size: 0, content: "" };
    const contentMatchOnce: IndexEntry = {
      path: "other.ts",
      size: 0,
      content: "breaker",
    };
    const terms = tokenize("breaker");

    const pathScore = scoreEntry(pathMatch, terms);
    const contentScore = scoreEntry(contentMatchOnce, terms);
    expect(pathScore).toBeGreaterThan(contentScore);

    const repeated: IndexEntry = {
      path: "repeated.ts",
      size: 0,
      content: "breaker ".repeat(20),
    };
    expect(scoreEntry(repeated, terms)).toBe(10); // capped at 10 occurrences
  });
});
