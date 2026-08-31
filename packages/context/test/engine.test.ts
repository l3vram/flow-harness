import { describe, expect, it } from "vitest";
import { ContextEngine } from "../src/engine.js";
import type { IndexEntry } from "../src/types.js";

const entries: IndexEntry[] = [
  { path: "circuit-breaker.ts", size: 0, content: "export class CircuitBreaker {}\n" },
  { path: "unrelated.ts", size: 0, content: "export const nothing = true;\n" },
  {
    path: "notes.md",
    size: 0,
    content: Array.from({ length: 20 }, (_, i) => `line ${i} mentions breaker sometimes`).join(
      "\n",
    ),
  },
];

describe("ContextEngine.assemble", () => {
  it("ranks the path+content match first and sets sources to item paths", () => {
    const engine = new ContextEngine(entries);
    const bundle = engine.assemble({ query: "circuit breaker" });

    expect(bundle.items[0]?.path).toBe("circuit-breaker.ts");
    expect(bundle.sources).toEqual(bundle.items.map((item) => item.path));
    expect(bundle.sources).not.toContain("unrelated.ts");
  });

  it("never exceeds the token budget, even under a tiny budget that forces packing", () => {
    const engine = new ContextEngine(entries);
    const bundle = engine.assemble({ query: "breaker", tokenBudget: 20 });

    expect(bundle.estimatedTokens).toBeLessThanOrEqual(bundle.tokenBudget);
    expect(bundle.tokenBudget).toBe(20);
  });

  it("returns an empty items array when no terms match", () => {
    const engine = new ContextEngine(entries);
    const bundle = engine.assemble({ query: "qxzjklw" });

    expect(bundle.items).toEqual([]);
    expect(bundle.sources).toEqual([]);
  });
});
