import { describe, it, expect } from "vitest";
import type { ModelRouter } from "@flow/llm";
import { deriveCriteria, parseCriteria } from "../src/index.js";

function routerReturning(text: string): ModelRouter {
  return { async complete() { return { text }; } } as unknown as ModelRouter;
}

describe("deriveCriteria", () => {
  it("turns acceptance statements into executable criteria via the LLM", async () => {
    const json = JSON.stringify({
      criteria: [
        { id: "health-200", description: "GET /health returns 200", verify: ["curl", "-fsS", "http://localhost:3000/health"], severity: "high", tags: ["api"] },
        { id: "prints-hi", description: "cli prints hi", verify: ["node", "-e", "process.exit(0)"] },
      ],
    });
    const criteria = await deriveCriteria(routerReturning(json), ["GET /health returns 200", "cli prints hi"]);
    expect(criteria).toHaveLength(2);
    expect(criteria[0]?.id).toBe("health-200");
    expect(criteria[0]?.verify).toEqual(["curl", "-fsS", "http://localhost:3000/health"]);
    expect(criteria[0]?.severity).toBe("high");
    expect(criteria[0]?.tags).toEqual(["api"]);
    expect(criteria[1]?.verify).toEqual(["node", "-e", "process.exit(0)"]);
  });

  it("returns [] for empty acceptance without calling the model", async () => {
    let called = false;
    const router = { async complete() { called = true; return { text: "{}" }; } } as unknown as ModelRouter;
    const criteria = await deriveCriteria(router, []);
    expect(criteria).toEqual([]);
    expect(called).toBe(false);
  });
});

describe("parseCriteria", () => {
  it("ignores prose around the JSON and defaults a missing verify to []", () => {
    const text = 'Here you go:\\n{ "criteria": [ { "id": "c1", "description": "d" } ] }\\nDone.';
    const criteria = parseCriteria(text);
    expect(criteria).toHaveLength(1);
    expect(criteria[0]?.id).toBe("c1");
    expect(criteria[0]?.verify).toEqual([]);
  });

  it("throws when there is no criteria array", () => {
    expect(() => parseCriteria("no json here")).toThrow(/no parseable JSON/);
    expect(() => parseCriteria('{ "nope": 1 }')).toThrow(/no parseable JSON/);
  });
});
