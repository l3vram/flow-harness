import type { Tier, Status } from "@flow/core";
import type { CeoDecision } from "@flow/ceo";
import type { VerifyResult } from "@flow/executor";
import type { RiskAssessment } from "@flow/review";

/** One task the orchestrator can dispatch: registered with the runtime and handed to the executor. */
export interface TaskSpec {
  id: string;
  role: string;
  tier: Tier;
  deps?: string[];
  instruction: string;
  verify?: string[];
}

export interface OrchestratorOptions {
  targetDir: string;
  maxSteps?: number;
  contextRoot?: string;
  maxRepairAttempts?: number;
}

/** The outcome of dispatching a single task through the executor. */
export interface TaskOutcome {
  status: Status;
  files: string[];
  verify: VerifyResult;
  reason: string;
  risk?: RiskAssessment;
  attempts?: number;
}

/** The full record of one autonomous run: every CEO decision and every task's final outcome. */
export interface RunReport {
  runId: string;
  objective: string;
  completed: boolean;
  decisions: CeoDecision[];
  outcomes: Record<string, TaskOutcome>;
  tasks: { id: string; status: Status }[]; // final status of every task
}

/** The on-disk config the CLI reads to start a run. */
export interface RunConfig {
  runId: string;
  objective: string;
  targetDir: string;
  verifyCommand?: string[];
  contextRoot?: string;
  maxSteps?: number;
  /** Human gates to pre-approve before the loop starts (e.g. ["A"] = the plan is approved). */
  approveGates?: string[];
  tasks?: TaskSpec[];
  /** The human has reviewed the LLM-generated plan and approves executing it. */
  acceptPlan?: boolean;
}
