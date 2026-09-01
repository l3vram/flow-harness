import { describe, expect, it } from "vitest";
import { fetchWithRetry, type FetchLike } from "../src/index.js";

function scriptedFetch(
  responses: Array<{ ok: boolean; status: number }>,
): { state: { calls: number }; fetchImpl: FetchLike } {
  const queue = [...responses];
  const state = { calls: 0 };
  const fetchImpl: FetchLike = async () => {
    state.calls++;
    const response = queue.length > 1 ? queue.shift()! : queue[0]!;
    return {
      ok: response.ok,
      status: response.status,
      async text() {
        return "";
      },
      async json() {
        return {};
      },
    };
  };
  return { state, fetchImpl };
}

const init = { method: "POST", headers: {}, body: "{}" };

describe("fetchWithRetry", () => {
  it("retries a 503 once and returns the eventual 200", async () => {
    const scripted = scriptedFetch([
      { ok: false, status: 503 },
      { ok: true, status: 200 },
    ]);
    const res = await fetchWithRetry(scripted.fetchImpl, "http://x", init, { baseMs: 0 });
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(scripted.state.calls).toBe(2);
  });

  it("exhausts retries on a persistent 503, making maxRetries + 1 calls", async () => {
    const scripted = scriptedFetch([{ ok: false, status: 503 }]);
    const res = await fetchWithRetry(scripted.fetchImpl, "http://x", init, {
      maxRetries: 2,
      baseMs: 0,
    });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(503);
    expect(scripted.state.calls).toBe(3);
  });

  it("does not retry a non-retryable status like 400", async () => {
    const scripted = scriptedFetch([{ ok: false, status: 400 }]);
    const res = await fetchWithRetry(scripted.fetchImpl, "http://x", init, { baseMs: 0 });
    expect(res.status).toBe(400);
    expect(scripted.state.calls).toBe(1);
  });

  it("makes a single call on an immediate 200", async () => {
    const scripted = scriptedFetch([{ ok: true, status: 200 }]);
    const res = await fetchWithRetry(scripted.fetchImpl, "http://x", init, { baseMs: 0 });
    expect(res.ok).toBe(true);
    expect(scripted.state.calls).toBe(1);
  });
});
