import { describe, it, expect } from "vitest";
import type { ModelRouter } from "@flow/llm";
import { research, parseResearch } from "../src/index.js";

function routerReturning(text: string): ModelRouter {
  return { async complete() { return { text }; } } as unknown as ModelRouter;
}

describe("research", () => {
  it("researches a query via the LLM and returns a parsed report", async () => {
    const json = JSON.stringify({
      summary: "Use Room with a Migration.",
      findings: ["Add a Migration object", "Bump the DB version"],
      sources: ["https://developer.android.com/training/data-storage/room/migrating-db-versions"],
    });
    const report = await research(routerReturning(json), "How do I migrate a Room database?");
    expect(report.query).toBe("How do I migrate a Room database?");
    expect(report.summary).toContain("Room");
    expect(report.findings).toHaveLength(2);
    expect(report.sources[0]).toContain("developer.android.com");
  });

  it("returns an empty report for a blank query without calling the model", async () => {
    let called = false;
    const router = { async complete() { called = true; return { text: "{}" }; } } as unknown as ModelRouter;
    const report = await research(router, "   ");
    expect(report.findings).toEqual([]);
    expect(called).toBe(false);
  });
});

describe("parseResearch", () => {
  it("ignores prose around the JSON and defaults missing arrays to []", () => {
    const text = 'Here:\\n{ "summary": "s", "findings": ["a"] }\\nDone.';
    const r = parseResearch("q", text);
    expect(r.summary).toBe("s");
    expect(r.findings).toEqual(["a"]);
    expect(r.sources).toEqual([]);
  });

  it("throws when there is no JSON", () => {
    expect(() => parseResearch("q", "nothing here")).toThrow(/no parseable JSON/);
  });
});
