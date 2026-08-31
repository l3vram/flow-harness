import { describe, it, expect } from "vitest";
import { estimateTokens } from "../src/index.js";

describe("estimateTokens", () => {
  it('returns 1 for "abcd"', () => {
    expect(estimateTokens("abcd")).toBe(1);
  });

  it('returns 0 for empty string', () => {
    expect(estimateTokens("")).toBe(0);
  });

  it('returns 1 for "a"', () => {
    expect(estimateTokens("a")).toBe(1);
  });

  it('returns 2 for "abcdefgh"', () => {
    expect(estimateTokens("abcdefgh")).toBe(2);
  });
});
