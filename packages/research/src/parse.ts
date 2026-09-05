import type { ResearchReport } from "./types.js";

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** Extracts the first JSON object from `text` and normalises it into a ResearchReport. */
export function parseResearch(query: string, text: string): ResearchReport {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("research: no parseable JSON");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error("research: no parseable JSON");
  }
  const obj = raw as Record<string, unknown>;
  return {
    query,
    summary: typeof obj.summary === "string" ? obj.summary : "",
    findings: strArray(obj.findings),
    sources: strArray(obj.sources),
  };
}
