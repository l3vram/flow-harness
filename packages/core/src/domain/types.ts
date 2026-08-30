// Core domain types. These mirror the shape of flow.sh's state.json so the CLI can be a
// drop-in replacement, but here they are typed and the state is a *projection* of events,
// never the source of truth.

/** Model tier. Kept as a widened string so provider-neutral profiles can slot in later. */
export type Tier = "haiku" | "sonnet" | "opus" | (string & {});

/** Lifecycle of a single plan/task. */
export type Status = "pending" | "running" | "review" | "green" | "blocked";

export const STATUSES: readonly Status[] = [
  "pending",
  "running",
  "review",
  "green",
  "blocked",
] as const;

export function isStatus(value: string): value is Status {
  return (STATUSES as readonly string[]).includes(value);
}

/** Human approval gate. A = plan approval, B = final review. */
export type GateId = "A" | "B";

export interface Plan {
  id: string;
  role: string;
  tier: Tier;
  status: Status;
  attempts: number;
  deps: string[];
  worktree: string;
  review: unknown | null;
  reason?: string;
}

export interface Budget {
  by_phase: Record<string, number>;
  by_tier: Record<string, number>;
  by_plan: Record<string, number>;
  spawns: number;
  notes: string;
}

/** The projected runtime state. Derived by folding the event log; a regenerable cache. */
export interface State {
  run: string;
  objective: string;
  phase: string;
  gates: Record<GateId, string>;
  current_wave: number;
  plans: Plan[];
  /** Derived from the plan dependency graph on every projection — never stored as truth. */
  waves: string[][];
  budget: Budget;
}
