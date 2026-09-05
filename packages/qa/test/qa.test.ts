import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runQA, type Criterion } from "../src/index.js";

describe("runQA", () => {
  let evidenceDir: string;
  let target: string;
  beforeEach(() => {
    evidenceDir = mkdtempSync(join(tmpdir(), "flow-qa-ev-"));
    target = mkdtempSync(join(tmpdir(), "flow-qa-target-"));
  });
  afterEach(() => {
    rmSync(evidenceDir, { recursive: true, force: true });
    rmSync(target, { recursive: true, force: true });
  });

  const pass = (id: string): Criterion => ({ id, description: id, verify: ["node", "-e", "process.exit(0)"] });

  it("all criteria pass -> complete, no tickets, evidence on disk", () => {
    const report = runQA({ target, platform: "node", criteria: [pass("a"), pass("b")] }, { evidenceDir });
    expect(report.complete).toBe(true);
    expect(report.summary).toBe("2/2 pass");
    expect(report.criteria.every((c) => c.status === "pass")).toBe(true);
    expect(report.criteria.flatMap((c) => c.tickets)).toHaveLength(0);
    expect(existsSync(join(evidenceDir, "a", "exit.txt"))).toBe(true);
    expect(existsSync(join(evidenceDir, "b", "stdout.txt"))).toBe(true);
  });

  it("a failing criterion -> fail + one ticket carrying the chosen fields", () => {
    const criteria: Criterion[] = [
      pass("ok"),
      { id: "bad", description: "must exit 0", verify: ["node", "-e", "process.exit(1)"], severity: "critical", tags: ["regression"] },
    ];
    const report = runQA({ target, platform: "node", criteria }, { evidenceDir });
    expect(report.complete).toBe(false);
    expect(report.summary).toBe("1/2 pass");
    const bad = report.criteria.find((c) => c.id === "bad");
    expect(bad?.status).toBe("fail");
    expect(bad?.tickets).toHaveLength(1);
    const ticket = bad?.tickets[0];
    expect(ticket?.criterionId).toBe("bad");
    expect(ticket?.severity).toBe("critical");
    expect(ticket?.repro).toEqual(["node -e process.exit(1)"]);
    expect(ticket?.tags).toEqual(["regression"]);
    expect(ticket?.evidence.length).toBeGreaterThan(0);
  });

  it("an empty verify -> pending, and the report is not complete", () => {
    const report = runQA({ target, platform: "node", criteria: [{ id: "todo", description: "later", verify: [] }] }, { evidenceDir });
    expect(report.criteria[0]?.status).toBe("pending");
    expect(report.complete).toBe(false);
  });

  it("writes the exit code as evidence", () => {
    runQA({ target, platform: "node", criteria: [{ id: "bad", description: "x", verify: ["node", "-e", "process.exit(1)"] }] }, { evidenceDir });
    expect(readFileSync(join(evidenceDir, "bad", "exit.txt"), "utf8")).toBe("1");
  });
});
