import { CEO_ACTIONS, type CeoDecision, type NewTask } from "./types.js";

/** Normalises the model's `newTasks` array into `NewTask[]`, skipping malformed entries. */
function parseNewTasks(value: unknown): NewTask[] {
  if (!Array.isArray(value)) return [];
  const out: NewTask[] = [];
  for (const item of value) {
    const t = item as Record<string, unknown>;
    if (typeof t.id !== "string" || t.id.length === 0) continue;
    if (typeof t.instruction !== "string" || t.instruction.length === 0) continue;
    const task: NewTask = {
      id: t.id,
      role: typeof t.role === "string" ? t.role : "backend",
      tier: typeof t.tier === "string" ? t.tier : "sonnet",
      instruction: t.instruction,
    };
    if (Array.isArray(t.deps)) task.deps = t.deps.filter((d): d is string => typeof d === "string");
    if (Array.isArray(t.verify) && t.verify.every((v) => typeof v === "string")) {
      task.verify = t.verify as string[];
    }
    out.push(task);
  }
  return out;
}

/**
 * Parses a CEO decision out of raw model text. Robust to surrounding prose: takes the substring
 * from the first `{` to the last `}` and parses that, since models sometimes wrap JSON in
 * commentary despite being told not to.
 */
export function parseDecision(text: string): CeoDecision {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  let raw: unknown;
  if (start === -1 || end === -1 || end < start) {
    throw new Error("CEO returned no parseable JSON decision");
  }
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error("CEO returned no parseable JSON decision");
  }

  const obj = raw as Record<string, unknown>;

  const action = obj.action;
  if (typeof action !== "string" || !(CEO_ACTIONS as readonly string[]).includes(action)) {
    throw new Error(`invalid CEO action: ${String(action)}`);
  }

  const taskIds =
    Array.isArray(obj.taskIds) && obj.taskIds.every((t) => typeof t === "string")
      ? (obj.taskIds as string[])
      : [];

  const newTasks = parseNewTasks(obj.newTasks);

  const reason = typeof obj.reason === "string" ? obj.reason : "";

  const rawConfidence = obj.confidence;
  const confidence =
    typeof rawConfidence === "number" && Number.isFinite(rawConfidence)
      ? Math.min(1, Math.max(0, rawConfidence))
      : 0;

  return { action: action as CeoDecision["action"], taskIds, newTasks, reason, confidence };
}
