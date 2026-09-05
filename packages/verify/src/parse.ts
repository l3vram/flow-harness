import type { Criterion } from "@flow/qa";

const SEVERITIES = ["low", "medium", "high", "critical"] as const;

/** Extracts the first JSON object from `text` and normalises its `criteria` into `Criterion[]`. */
export function parseCriteria(text: string): Criterion[] {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("verify: no parseable JSON");
  }
  let raw: any;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error("verify: no parseable JSON");
  }
  if (!Array.isArray(raw.criteria)) {
    throw new Error("verify: no parseable JSON");
  }
  return raw.criteria.map((c: any, idx: number): Criterion => {
    if (typeof c.id !== "string" || c.id.trim() === "") {
      throw new Error(`criterion at index ${idx} is missing a non-empty string id`);
    }
    const criterion: Criterion = {
      id: c.id,
      description: typeof c.description === "string" ? c.description : c.id,
      verify:
        Array.isArray(c.verify) && c.verify.every((v: any) => typeof v === "string") ? c.verify : [],
    };
    if (typeof c.severity === "string" && (SEVERITIES as readonly string[]).includes(c.severity)) {
      criterion.severity = c.severity as Criterion["severity"];
    }
    if (Array.isArray(c.tags) && c.tags.every((v: any) => typeof v === "string")) {
      criterion.tags = c.tags;
    }
    return criterion;
  });
}
