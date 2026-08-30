import { describe, expect, it } from "vitest";
import { project, type Event } from "../src/index.js";

const events: Event[] = [
  { type: "run.started", ts: "t", run: "r1", objective: "obj" },
  { type: "task.added", ts: "t", id: "a", role: "backend", tier: "sonnet", deps: [] },
  { type: "task.added", ts: "t", id: "b", role: "frontend", tier: "haiku", deps: ["a"] },
  { type: "task.status", ts: "t", id: "a", status: "running" },
  { type: "task.status", ts: "t", id: "a", status: "green" },
  { type: "budget.charged", ts: "t", id: "a", tokens: 100, tier: "sonnet", phase: "exec" },
  { type: "gate.recorded", ts: "t", gate: "A", status: "approved" },
];

describe("project", () => {
  it("folds the event log into the expected state", () => {
    const s = project(events);
    expect(s.run).toBe("r1");
    expect(s.objective).toBe("obj");
    expect(s.gates.A).toBe("approved");
    expect(s.gates.B).toBe("pending");

    const a = s.plans.find((pl) => pl.id === "a");
    expect(a?.status).toBe("green");
    expect(a?.attempts).toBe(1);
    expect(a?.worktree).toBe("wt-a");

    expect(s.waves).toEqual([["a"], ["b"]]);
    expect(s.budget.by_plan.a).toBe(100);
    expect(s.budget.by_tier.sonnet).toBe(100);
    expect(s.budget.by_phase.exec).toBe(100);
    expect(s.budget.spawns).toBe(1);
  });

  it("is a pure function of its input", () => {
    expect(project(events)).toEqual(project(events));
  });
});
