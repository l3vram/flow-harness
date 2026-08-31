import { indexProject, type IndexOptions } from "./indexer.js";
import { estimateTokens, scoreEntry, tokenize } from "./score.js";
import type { ContextBundle, ContextRequest, IndexEntry } from "./types.js";

const DEFAULT_TOKEN_BUDGET = 8000;
const SNIPPET_LINE_COUNT = 10;
const SNIPPET_MAX_CHARS = 800;

/**
 * Deterministic, LLM-free context assembly: rank indexed entries against a query, extract a
 * relevant snippet from each, and greedily pack the highest-scoring ones into a token budget.
 */
export class ContextEngine {
  constructor(private readonly entries: IndexEntry[]) {}

  static index(root: string, options?: IndexOptions): ContextEngine {
    return new ContextEngine(indexProject(root, options));
  }

  get size(): number {
    return this.entries.length;
  }

  assemble(request: ContextRequest): ContextBundle {
    const terms = tokenize(request.query);
    const budget = request.tokenBudget ?? DEFAULT_TOKEN_BUDGET;

    const scored = this.entries
      .map((entry) => ({ entry, score: scoreEntry(entry, terms) }))
      .filter((scoredEntry) => scoredEntry.score > 0);

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.entry.path < b.entry.path ? -1 : a.entry.path > b.entry.path ? 1 : 0;
    });

    const items: ContextBundle["items"] = [];
    let runningTotal = 0;
    for (const { entry, score } of scored) {
      const snippet = extractSnippet(entry.content, terms);
      const itemTokens = estimateTokens(snippet);
      if (runningTotal + itemTokens > budget) continue; // skip; keep trying smaller later ones
      items.push({ path: entry.path, snippet, score, estimatedTokens: itemTokens });
      runningTotal += itemTokens;
    }

    return {
      items,
      sources: items.map((item) => item.path),
      tokenBudget: budget,
      estimatedTokens: runningTotal,
    };
  }
}

/**
 * Extract a snippet around the first line matching any query term (case-insensitive): that
 * line plus up to the next 9 lines. Falls back to the first 10 lines when nothing matches.
 * Hard-capped at 800 characters so one huge file can't dominate the budget.
 */
function extractSnippet(content: string, terms: string[]): string {
  const lines = content.split("\n");

  let startLine = 0;
  if (terms.length > 0) {
    const matchIndex = lines.findIndex((line) => {
      const lowerLine = line.toLowerCase();
      return terms.some((term) => lowerLine.includes(term));
    });
    if (matchIndex !== -1) startLine = matchIndex;
  }

  const snippet = lines.slice(startLine, startLine + SNIPPET_LINE_COUNT).join("\n");
  return snippet.slice(0, SNIPPET_MAX_CHARS);
}
