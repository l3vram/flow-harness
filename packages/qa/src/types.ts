export type Status = "pass" | "fail" | "pending";

export interface Criterion {
  id: string;
  description: string;
  /** argv run in `target` (spawnSync, no shell). An empty array means the criterion is pending. */
  verify: string[];
  /** Ticket severity when this criterion fails; defaults to "high". */
  severity?: "low" | "medium" | "high" | "critical";
  /** Propagated onto the ticket when this criterion fails. */
  tags?: string[];
}

export interface QARequest {
  target: string;
  platform: string;
  criteria: Criterion[];
}

/** A pointer to one evidence artifact written to disk. */
export interface EvidenceRef {
  kind: string;
  path: string;
}

export interface Ticket {
  id: string;
  criterionId: string;
  severity: string;
  symptom: string;
  evidence: EvidenceRef[];
  /** file:line / selector — best-effort; left unset in Layer A. */
  location?: string;
  /** The verify argv, as a minimal reproduction. */
  repro?: string[];
  tags?: string[];
}

export interface CriterionResult {
  id: string;
  description: string;
  status: Status;
  evidence: EvidenceRef[];
  tickets: Ticket[];
}

export interface QAReport {
  target: string;
  platform: string;
  criteria: CriterionResult[];
  summary: string;
  complete: boolean;
  evidenceDir: string;
}
