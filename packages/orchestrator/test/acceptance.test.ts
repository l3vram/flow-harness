import { describe, it, expect } from "vitest";
import { attachAcceptanceCriteria, type TaskSpec } from "../src/index.js";

describe("attachAcceptanceCriteria", () => {
  const tasks: TaskSpec[] = [
    { id: "a", role: "backend", tier: "sonnet", deps: [], instruction: "do a" },
    { id: "b", role: "backend", tier: "sonnet", deps: ["a"], instruction: "do b" },
  ];
  const criteria = [{ id: "c1", description: "works", verify: ["node", "-e", "process.exit(0)"] }];

  it("attaches criteria to the final task only, without mutating the input", () => {
    const out = attachAcceptanceCriteria(tasks, criteria);
    expect(out[0]?.criteria).toBeUndefined();
    expect(out[1]?.criteria).toEqual(criteria);
    expect(tasks[1]?.criteria).toBeUndefined();
  });

  it("is a no-op with no tasks or no criteria", () => {
    expect(attachAcceptanceCriteria([], criteria)).toEqual([]);
    expect(attachAcceptanceCriteria(tasks, [])).toBe(tasks);
  });
});
