import { describe, it, expect } from "vitest";
import { evaluateRunReport, type RunReport } from "../src/index.js";

function baseReport(over: Partial<RunReport>): RunReport {
  return { runId: "r", objective: "o", completed: true, decisions: [], outcomes: {}, tasks: [], ...over };
}

describe("evaluateRunReport", () => {
  it("scores a clean run 100", () => {
    const report = baseReport({
      tasks: [{ id: "a", status: "green" }, { id: "b", status: "green" }],
      outcomes: {
        a: { status: "green", files: [], verify: { ran: true, ok: true, output: "" }, reason: "", attempts: 1, qa: { target: "t", platform: "node", summary: "1/1 pass", complete: true, evidenceDir: "e", criteria: [{ id: "c1", description: "d", status: "pass", evidence: [], tickets: [] }] } },
        b: { status: "green", files: [], verify: { ran: true, ok: true, output: "" }, reason: "", attempts: 1, qa: { target: "t", platform: "node", summary: "1/1 pass", complete: true, evidenceDir: "e", criteria: [{ id: "c2", description: "d", status: "pass", evidence: [], tickets: [] }] } },
      },
    });
    const ev = evaluateRunReport(report);
    expect(ev.score).toBe(100);
    expect(ev.dimensions.find((d) => d.name === "verification")?.score).toBe(100);
  });

  it("reflects a blocked task, a failed criterion, and a critical ticket", () => {
    const report = baseReport({
      tasks: [{ id: "a", status: "green" }, { id: "b", status: "blocked" }],
      outcomes: {
        b: { status: "blocked", files: [], verify: { ran: true, ok: false, output: "" }, reason: "", attempts: 3, qa: { target: "t", platform: "node", summary: "0/1 pass", complete: false, evidenceDir: "e", criteria: [{ id: "c1", description: "d", status: "fail", evidence: [], tickets: [{ id: "c1-fail", criterionId: "c1", severity: "critical", symptom: "x", evidence: [] }] }] } },
      },
    });
    const ev = evaluateRunReport(report);
    expect(ev.score).toBeLessThan(100);
    expect(ev.dimensions.find((d) => d.name === "verification")?.score).toBe(0);
    expect(ev.dimensions.find((d) => d.name === "safety")?.score).toBe(75);
  });
});
