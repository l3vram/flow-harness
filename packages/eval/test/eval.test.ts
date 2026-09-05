import { describe, it, expect } from "vitest";
import { evaluate, compare, type EvalInput } from "../src/index.js";

const perfect: EvalInput = {
  tasksTotal: 3, tasksGreen: 3, tasksBlocked: 0, tasksReview: 0,
  criteriaTotal: 4, criteriaPassed: 4, criticalTickets: 0, attempts: 3,
};
const poor: EvalInput = {
  tasksTotal: 3, tasksGreen: 1, tasksBlocked: 2, tasksReview: 0,
  criteriaTotal: 4, criteriaPassed: 1, criticalTickets: 2, attempts: 8,
};

describe("evaluate", () => {
  it("scores a perfect run 100", () => {
    const r = evaluate(perfect);
    expect(r.score).toBe(100);
    expect(r.dimensions.find((d) => d.name === "verification")?.score).toBe(100);
  });

  it("scores a poor run low and reflects failed verification and critical tickets", () => {
    const r = evaluate(poor);
    expect(r.score).toBeLessThan(60);
    expect(r.dimensions.find((d) => d.name === "verification")?.score).toBe(25);
    expect(r.dimensions.find((d) => d.name === "safety")?.score).toBe(50);
  });

  it("a zero-denominator ratio scores 100 (nothing to fault)", () => {
    const r = evaluate({ tasksTotal: 0, tasksGreen: 0, tasksBlocked: 0, tasksReview: 0, criteriaTotal: 0, criteriaPassed: 0, criticalTickets: 0, attempts: 0 });
    expect(r.dimensions.find((d) => d.name === "verification")?.score).toBe(100);
  });
});

describe("compare", () => {
  it("reports the better run", () => {
    const c = compare(evaluate(poor), evaluate(perfect));
    expect(c.verdict).toBe("better");
    expect(c.scoreDelta).toBeGreaterThan(0);
  });
});
