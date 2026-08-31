import { CEO_ACTIONS, type CeoDecision } from "./types.js";

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

  const reason = typeof obj.reason === "string" ? obj.reason : "";

  const rawConfidence = obj.confidence;
  const confidence =
    typeof rawConfidence === "number" && Number.isFinite(rawConfidence)
      ? Math.min(1, Math.max(0, rawConfidence))
      : 0;

  return { action: action as CeoDecision["action"], taskIds, reason, confidence };
}
