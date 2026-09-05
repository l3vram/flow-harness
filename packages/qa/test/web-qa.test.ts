import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runWebQA, FakeWebDriver, type WebCriterion } from "../src/index.js";

describe("runWebQA", () => {
  let evidenceDir: string;
  beforeEach(() => {
    evidenceDir = mkdtempSync(join(tmpdir(), "flow-webqa-ev-"));
  });
  afterEach(() => {
    rmSync(evidenceDir, { recursive: true, force: true });
  });

  it("passes when the page matches the steps, and writes screenshot + console/network evidence", async () => {
    const driver = new FakeWebDriver({ text: "Welcome HELLO", selectors: ["#app"], console: ["ready"], network: ["GET /"] });
    const criteria: WebCriterion[] = [
      {
        id: "home",
        description: "home shows the greeting",
        steps: [
          { kind: "goto", url: "/" },
          { kind: "expectText", text: "HELLO" },
          { kind: "expectSelector", selector: "#app" },
          { kind: "screenshot", name: "home" },
        ],
      },
    ];
    const report = await runWebQA({ target: "http://localhost:3000", platform: "web", criteria }, driver, { evidenceDir });
    expect(report.complete).toBe(true);
    expect(report.summary).toBe("1/1 pass");
    expect(driver.visited).toContain("http://localhost:3000/");
    expect(existsSync(join(evidenceDir, "home", "home.png"))).toBe(true);
    expect(readFileSync(join(evidenceDir, "home", "console.txt"), "utf8")).toContain("ready");
  });

  it("fails a criterion, files a ticket, and captures a failure screenshot", async () => {
    const driver = new FakeWebDriver({ text: "Goodbye", selectors: [] });
    const criteria: WebCriterion[] = [
      {
        id: "greeting",
        description: "must greet",
        severity: "critical",
        tags: ["ui"],
        steps: [
          { kind: "goto", url: "/" },
          { kind: "expectText", text: "HELLO" },
        ],
      },
    ];
    const report = await runWebQA({ target: "http://localhost:3000", platform: "web", criteria }, driver, { evidenceDir });
    expect(report.complete).toBe(false);
    const c = report.criteria[0];
    expect(c?.status).toBe("fail");
    expect(c?.tickets).toHaveLength(1);
    expect(c?.tickets[0]?.severity).toBe("critical");
    expect(c?.tickets[0]?.tags).toEqual(["ui"]);
    expect(c?.tickets[0]?.symptom).toContain("expected text not found");
    expect(existsSync(join(evidenceDir, "greeting", "failure.png"))).toBe(true);
  });
});
