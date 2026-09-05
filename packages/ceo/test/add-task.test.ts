import { describe, it, expect } from "vitest";
import { parseDecision } from "../src/parse.js";

describe("parseDecision — add_task", () => {
  it("parses an add_task decision with newTasks (deps/verify preserved, defaults applied)", () => {
    const text = JSON.stringify({
      action: "add_task",
      taskIds: [],
      newTasks: [
        { id: "migrate-db", role: "backend", tier: "sonnet", deps: ["schema"], instruction: "add a migration", verify: ["npm", "test"] },
        { id: "docs", instruction: "document it" },
      ],
      reason: "execution revealed a missing migration",
      confidence: 0.8,
    });
    const d = parseDecision(text);
    expect(d.action).toBe("add_task");
    expect(d.newTasks).toHaveLength(2);
    expect(d.newTasks[0]?.id).toBe("migrate-db");
    expect(d.newTasks[0]?.deps).toEqual(["schema"]);
    expect(d.newTasks[0]?.verify).toEqual(["npm", "test"]);
    expect(d.newTasks[1]?.role).toBe("backend");
    expect(d.newTasks[1]?.tier).toBe("sonnet");
  });

  it("defaults newTasks to [] for other actions", () => {
    const d = parseDecision('{"action":"dispatch","taskIds":["a"],"reason":"go","confidence":0.9}');
    expect(d.action).toBe("dispatch");
    expect(d.newTasks).toEqual([]);
  });
});
