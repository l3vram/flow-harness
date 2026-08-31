/** The single move the CEO can choose on any given decision cycle. */
export type CeoAction = "dispatch" | "advance" | "await_human" | "complete";

export const CEO_ACTIONS: readonly CeoAction[] = ["dispatch", "advance", "await_human", "complete"];

/** The CEO's structured decision, parsed from the model's raw JSON reply. */
export interface CeoDecision {
  action: CeoAction;
  /** Ids to run for "dispatch"; empty for every other action. */
  taskIds: string[];
  /** One short sentence explaining the choice. */
  reason: string;
  /** 0..1, MODEL-REPORTED — never trusted for an automatic risk decision. */
  confidence: number;
}
