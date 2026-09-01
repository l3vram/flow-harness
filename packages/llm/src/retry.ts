import type { FetchLike } from "./providers/openai-compatible.js";

export interface RetryOptions {
  maxRetries?: number;
  baseMs?: number;
}

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

/**
 * Calls `fetchImpl`, retrying on transient HTTP statuses (429/408/5xx) with exponential backoff
 * + jitter, up to `maxRetries` times. Returns the final response; the caller still checks `.ok`.
 * A non-retryable status (e.g. 400/401/404) returns immediately, and a 2xx returns immediately.
 */
export async function fetchWithRetry(
  fetchImpl: FetchLike,
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
  options: RetryOptions = {},
): Promise<Awaited<ReturnType<FetchLike>>> {
  const maxRetries = options.maxRetries ?? 3;
  const baseMs = options.baseMs ?? 500;
  let res = await fetchImpl(url, init);
  let attempt = 0;
  while (!res.ok && RETRYABLE.has(res.status) && attempt < maxRetries) {
    const delay = baseMs * 2 ** attempt + Math.floor(Math.random() * baseMs);
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    attempt++;
    res = await fetchImpl(url, init);
  }
  return res;
}
