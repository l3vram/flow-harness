import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CriterionResult, EvidenceRef, QAReport, Status, Ticket } from "./types.js";
import type { WebCriterion, WebDriver, WebQARequest } from "./web-types.js";

/** Resolves a step's url against the base target (an absolute url wins; a leading-slash path joins the base). */
function resolveUrl(target: string, url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/") && /^https?:\/\//i.test(target)) return target.replace(/\/+$/, "") + url;
  return url.length > 0 ? url : target;
}

async function runWebCriterion(
  req: WebQARequest,
  criterion: WebCriterion,
  driver: WebDriver,
  evidenceDir: string,
): Promise<CriterionResult> {
  const dir = join(evidenceDir, criterion.id);
  mkdirSync(dir, { recursive: true });
  const evidence: EvidenceRef[] = [];
  let failure: string | undefined;

  let stepIndex = 0;
  for (const step of criterion.steps) {
    if (failure !== undefined) break;
    if (step.kind === "goto") {
      await driver.goto(resolveUrl(req.target, step.url));
    } else if (step.kind === "expectText") {
      const text = await driver.pageText();
      if (!text.includes(step.text)) failure = `expected text not found: ${JSON.stringify(step.text)}`;
    } else if (step.kind === "expectSelector") {
      const present = await driver.hasSelector(step.selector);
      if (!present) failure = `expected selector not found: ${step.selector}`;
    } else {
      const name = (step.name ?? `step-${stepIndex}`) + ".png";
      const path = join(dir, name);
      await driver.screenshot(path);
      evidence.push({ kind: "screenshot", path });
    }
    stepIndex += 1;
  }

  // Always capture console + network logs as evidence artifacts.
  const consolePath = join(dir, "console.txt");
  const networkPath = join(dir, "network.txt");
  writeFileSync(consolePath, driver.consoleMessages().join("\n"), "utf8");
  writeFileSync(networkPath, driver.networkRequests().join("\n"), "utf8");
  evidence.push({ kind: "console", path: consolePath }, { kind: "network", path: networkPath });

  const status: Status = failure === undefined ? "pass" : "fail";
  const tickets: Ticket[] = [];
  if (failure !== undefined) {
    const shotPath = join(dir, "failure.png");
    await driver.screenshot(shotPath);
    evidence.push({ kind: "screenshot", path: shotPath });
    const ticket: Ticket = {
      id: `${criterion.id}-fail`,
      criterionId: criterion.id,
      severity: criterion.severity ?? "high",
      symptom: failure,
      evidence,
    };
    if (criterion.tags !== undefined) ticket.tags = criterion.tags;
    tickets.push(ticket);
  }

  return { id: criterion.id, description: criterion.description, status, evidence, tickets };
}

/**
 * Runs a web QA request through a WebDriver (a real Playwright browser or the offline FakeWebDriver):
 * drives each criterion's structured steps, captures evidence (screenshots, console, network), and returns
 * the same deterministic QAReport contract as Layer A. Emits evidence, verdicts and tickets — never decisions.
 */
export async function runWebQA(
  req: WebQARequest,
  driver: WebDriver,
  opts?: { evidenceDir?: string },
): Promise<QAReport> {
  const evidenceDir = opts?.evidenceDir ?? mkdtempSync(join(tmpdir(), "flow-webqa-"));
  const criteria: CriterionResult[] = [];
  try {
    for (const criterion of req.criteria) {
      criteria.push(await runWebCriterion(req, criterion, driver, evidenceDir));
    }
  } finally {
    await driver.close();
  }
  const passCount = criteria.filter((c) => c.status === "pass").length;
  const complete = criteria.length > 0 && criteria.every((c) => c.status === "pass");
  return {
    target: req.target,
    platform: req.platform,
    criteria,
    summary: `${passCount}/${criteria.length} pass`,
    complete,
    evidenceDir,
  };
}
