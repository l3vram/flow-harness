import { describe, expect, it } from "vitest";
import { OpenAICompatibleProvider, type FetchLike } from "../src/index.js";

function cannedFetch(response: {
  ok: boolean;
  status: number;
  body: unknown;
}): { calls: Array<{ url: string; init: { method: string; headers: Record<string, string>; body: string } }>; fetchImpl: FetchLike } {
  const calls: Array<{ url: string; init: { method: string; headers: Record<string, string>; body: string } }> = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: response.ok,
      status: response.status,
      async text() {
        return JSON.stringify(response.body);
      },
      async json() {
        return response.body;
      },
    };
  };
  return { calls, fetchImpl };
}

describe("OpenAICompatibleProvider", () => {
  it("posts to /chat/completions with bearer auth and max_tokens, parses the response", async () => {
    const { calls, fetchImpl } = cannedFetch({
      ok: true,
      status: 200,
      body: {
        model: "gpt-4o-mini",
        choices: [{ message: { content: "hello back" } }],
        usage: { prompt_tokens: 7, completion_tokens: 2 },
      },
    });
    const provider = new OpenAICompatibleProvider({
      baseUrl: "https://api.example.com/v1/",
      apiKey: "secret-key",
      fetchImpl,
    });

    const result = await provider.complete({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 128,
    });

    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call).toBeDefined();
    expect(call?.url).toBe("https://api.example.com/v1/chat/completions");
    expect(call?.init.headers["authorization"]).toBe("Bearer secret-key");
    const body = JSON.parse(call?.init.body ?? "{}");
    expect(body.max_tokens).toBe(128);

    expect(result.text).toBe("hello back");
    expect(result.model).toBe("gpt-4o-mini");
    expect(result.usage).toEqual({ inputTokens: 7, outputTokens: 2 });
  });

  it("omits the authorization header when no apiKey is given", async () => {
    const { calls, fetchImpl } = cannedFetch({
      ok: true,
      status: 200,
      body: { choices: [{ message: { content: "x" } }] },
    });
    const provider = new OpenAICompatibleProvider({ baseUrl: "http://localhost:1234", fetchImpl });
    await provider.complete({ model: "m", messages: [] });
    expect(calls[0]?.init.headers["authorization"]).toBeUndefined();
  });

  it("throws with the status code on a non-ok response", async () => {
    const { fetchImpl } = cannedFetch({ ok: false, status: 500, body: { error: "boom" } });
    const provider = new OpenAICompatibleProvider({ baseUrl: "http://localhost:1234", fetchImpl });
    await expect(provider.complete({ model: "m", messages: [] })).rejects.toThrow(/500/);
  });
});
