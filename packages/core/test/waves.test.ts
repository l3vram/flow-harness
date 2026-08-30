import { describe, expect, it } from "vitest";
import { computeWaves, type Plan } from "../src/index.js";

const p = (id: string, deps: string[] = []): Plan => ({
  id,
  role: "x",
  tier: "haiku",
  status: "pending",
  attempts: 0,
  deps,
  worktree: "wt-" + id,
  review: null,
});

describe("computeWaves", () => {
  it("layers a diamond DAG into three waves", () => {
    const { waves, cycle } = computeWaves([p("a"), p("b", ["a"]), p("c", ["a"]), p("d", ["b", "c"])]);
    expect(waves).toEqual([["a"], ["b", "c"], ["d"]]);
    expect(cycle).toEqual([]);
  });

  it("puts independent plans in the same first wave", () => {
    const { waves } = computeWaves([p("a"), p("b"), p("c")]);
    expect(waves).toEqual([["a", "b", "c"]]);
  });

  it("detects a two-node cycle and names both culprits", () => {
    const { cycle } = computeWaves([p("a", ["b"]), p("b", ["a"])]);
    expect(cycle).toEqual(["a", "b"]);
  });

  it("reports an empty graph as zero waves", () => {
    expect(computeWaves([])).toEqual({ waves: [], cycle: [] });
  });
});
