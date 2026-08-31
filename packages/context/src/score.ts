import type { IndexEntry } from "./types.js";

/**
 * Cheap heuristic token estimate — NOT a real tokenizer. Good enough to budget snippets
 * deterministically without depending on any model's actual encoding.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Lowercase, split on non-alphanumeric runs, drop empties and terms shorter than 2 chars,
 * de-duplicate while preserving first-seen order. */
export function tokenize(query: string): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const term of query.toLowerCase().split(/[^a-z0-9]+/)) {
    if (term.length < 2) continue;
    if (seen.has(term)) continue;
    seen.add(term);
    terms.push(term);
  }
  return terms;
}

/**
 * Deterministic relevance score for one indexed entry against a set of query terms.
 * A path match is weighted heavily (5 points per matching term); content matches count
 * occurrences, capped at 10 per term so one very repetitive file can't dominate.
 */
export function scoreEntry(entry: IndexEntry, terms: string[]): number {
  const lowerPath = entry.path.toLowerCase();
  const lowerContent = entry.content.toLowerCase();

  let pathScore = 0;
  for (const term of terms) {
    if (lowerPath.includes(term)) pathScore += 5;
  }

  let contentScore = 0;
  for (const term of terms) {
    contentScore += Math.min(countOccurrences(lowerContent, term), 10);
  }

  return pathScore + contentScore;
}

/** Counts non-overlapping occurrences of `term` in `text`. */
function countOccurrences(text: string, term: string): number {
  if (term === "") return 0;
  let count = 0;
  let index = 0;
  for (;;) {
    const found = text.indexOf(term, index);
    if (found === -1) break;
    count += 1;
    index = found + term.length;
  }
  return count;
}
