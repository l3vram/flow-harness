import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  Criterion,
  CriterionResult,
  EvidenceRef,
  QARequest,
  QAReport,
  Status,
  Ticket,
} from "./types.js";

/** First non-empty, trimmed line of `text`, or "" when there is none. */
function firstLine(text: string): string {
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.length > 0) return line;
  }
  return "";
}

/** Runs one criterion's verify command in `target`, captures evidence, and classifies the result. */
function runCriterion(target: string, criterion: Criterion, evidenceDir: string): CriterionResult {
  const dir = join(evidenceDir, criterion.id);
  mkdirSync(dir, { recursive: true });

  const [cmd, ...args] = criterion.verify;
  if (cmd === undefined) {
    // No verify command configured — the criterion is not yet verified.
    return { id: criterion.id, description: criterion.description, status: "pending", evidence: [], tickets: [] };
  }

  const res = spawnSync(cmd, args, { cwd: target, encoding: "utf8" });
  const stdout = res.stdout ?? "";
  const stderr = res.stderr ?? "";
  const exit = res.status === null ? "null" : String(res.status);

  const stdoutPath = join(dir, "stdout.txt");
  const stderrPath = join(dir, "stderr.txt");
  const exitPath = join(dir, "exit.txt");
  writeFileSync(stdoutPath, stdout, "utf8");
  writeFileSync(stderrPath, stderr, "utf8");
  writeFileSync(exitPath, exit, "utf8");
  const evidence: EvidenceRef[] = [
    { kind: "stdout", path: stdoutPath },
    { kind: "stderr", path: stderrPath },
    { kind: "exit", path: exitPath },
  ];

  const ok = res.status === 0;
  const status: Status = ok ? "pass" : "fail";
  const tickets: Ticket[] = [];
  if (!ok) {
    const symptom =
      firstLine(stderr) || firstLine(stdout) || (res.error ? res.error.message : `exit ${exit}`);
    const ticket: Ticket = {
      id: `${criterion.id}-fail`,
      criterionId: criterion.id,
      severity: criterion.severity ?? "high",
      symptom,
      evidence,
      repro: [criterion.verify.join(" ")],
    };
    if (criterion.tags !== undefined) ticket.tags = criterion.tags;
    tickets.push(ticket);
  }

  return { id: criterion.id, description: criterion.description, status, evidence, tickets };
}

/**
 * Runs a QA request: verifies each acceptance criterion with its own explicit command, writes evidence
 * artifacts under `evidenceDir`, and returns a QA report with per-criterion verdicts and error tickets.
 * Deterministic and offline — no network, no browser, no LLM. QA emits evidence, verdicts and tickets,
 * never decisions: it does not mark work "done" and does not propose fixes.
 */
export function runQA(req: QARequest, opts?: { evidenceDir?: string }): QAReport {
  const evidenceDir = opts?.evidenceDir ?? mkdtempSync(join(tmpdir(), "flow-qa-"));
  const criteria = req.criteria.map((c) => runCriterion(req.target, c, evidenceDir));
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
