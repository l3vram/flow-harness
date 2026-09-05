/** The single move the CEO can choose on any given decision cycle. */
export type CeoAction = "dispatch" | "advance" | "await_human" | "complete" | "add_task";

export const CEO_ACTIONS: readonly CeoAction[] = ["dispatch", "advance", "await_human", "complete", "add_task"];

/** A task the CEO wants to add to the DAG mid-run — dynamic replanning (create). */
export interface NewTask {
  id: string;
  role: string;
  tier: string;
  deps?: string[];
  instruction: string;
  verify?: string[];
}

/** The CEO's structured decision, parsed from the model's raw JSON reply. */
export interface CeoDecision {
  action: CeoAction;
  /** Ids to run for "dispatch"; empty for every other action. */
  taskIds: string[];
  /** Tasks to add to the DAG for "add_task"; empty for every other action. */
  newTasks: NewTask[];
  /** One short sentence explaining the choice. */
  reason: string;
  /** 0..1, MODEL-REPORTED — never trusted for an automatic risk decision. */
  confidence: number;
}
