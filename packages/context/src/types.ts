/**
 * Types for the deterministic, LLM-free context engine: index a project directory, score
 * entries against a query, and assemble a token-budgeted bundle of snippets with attribution.
 */

/** One indexed text file. `path` is relative to the indexed root, POSIX separators. */
export interface IndexEntry {
  path: string;
  size: number;
  content: string;
}

/** One snippet selected into a context bundle, with its score and estimated token cost. */
export interface ContextItem {
  path: string;
  snippet: string;
  score: number;
  estimatedTokens: number;
}

export interface ContextBundle {
  items: ContextItem[];
  sources: string[]; // item paths, in order
  tokenBudget: number;
  estimatedTokens: number; // sum over items — an ESTIMATE, never a billed count
}

export interface ContextRequest {
  query: string;
  tokenBudget?: number;
}
