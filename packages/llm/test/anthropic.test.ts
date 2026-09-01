import { describe, expect, it } from "vitest";
import { AnthropicProvider, type FetchLike } from "../src/index.js";

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

describe("AnthropicProvider", () => {
  it("posts to /messages with x-api-key auth, a top-level system field, and parses the response", async () => {
    const { calls, fetchImpl } = cannedFetch({
      ok: true,
      status: 200,
      body: {
        model: "claude-opus-5",
        content: [{ type: "text", text: "hi" }],
        usage: { input_tokens: 5, output_tokens: 2 },
      },
    });
    const provider = new AnthropicProvider({
      baseUrl: "https://api.anthropic.com/v1/",
      apiKey: "secret-key",
      fetchImpl,
    });

    const result = await provider.complete({
      model: "claude-opus-5",
      messages: [
        { role: "system", content: "be terse" },
        { role: "user", content: "hi" },
      ],
      maxTokens: 128,
    });

    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call).toBeDefined();
    expect(call?.url).toBe("https://api.anthropic.com/v1/messages");
    expect(call?.init.headers["x-api-key"]).toBe("secret-key");
    expect(call?.init.headers["anthropic-version"]).toBe("2023-06-01");

    const body = JSON.parse(call?.init.body ?? "{}");
    expect(body.max_tokens).toBe(128);
    expect(body.system).toBe("be terse");
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);

    expect(result.text).toBe("hi");
    expect(result.model).toBe("claude-opus-5");
    expect(result.usage).toEqual({ inputTokens: 5, outputTokens: 2 });
  });

  it("omits system and x-api-key when there is no system message or apiKey", async () => {
    const { calls, fetchImpl } = cannedFetch({
      ok: true,
      status: 200,
      body: { model: "claude-haiku-4-5", content: [{ type: "text", text: "x" }] },
    });
    const provider = new AnthropicProvider({ baseUrl: "http://localhost:1234", fetchImpl });
    await provider.complete({ model: "claude-haiku-4-5", messages: [{ role: "user", content: "hi" }] });

    expect(calls[0]?.init.headers["x-api-key"]).toBeUndefined();
    const body = JSON.parse(calls[0]?.init.body ?? "{}");
    expect(body.system).toBeUndefined();
  });

  it("uses the default max_tokens (4096) when none is given", async () => {
    const { calls, fetchImpl } = cannedFetch({
      ok: true,
      status: 200,
      body: { content: [{ type: "text", text: "x" }] },
    });
    const provider = new AnthropicProvider({ baseUrl: "http://localhost:1234", fetchImpl });
    await provider.complete({ model: "m", messages: [] });
    const body = JSON.parse(calls[0]?.init.body ?? "{}");
    expect(body.max_tokens).toBe(4096);
  });

  it("throws with the status code on a non-ok response", async () => {
    const { fetchImpl } = cannedFetch({ ok: false, status: 500, body: { error: "boom" } });
    const provider = new AnthropicProvider({
      baseUrl: "http://localhost:1234",
      fetchImpl,
      retryBaseMs: 0,
    });
    await expect(provider.complete({ model: "m", messages: [] })).rejects.toThrow(/500/);
  });

  it("retries a transient 503 and succeeds on the following 200", async () => {
    const responses = [
      { ok: false, status: 503, body: { error: "unavailable" } },
      {
        ok: true,
        status: 200,
        body: { model: "claude-opus-5", content: [{ type: "text", text: "recovered" }] },
      },
    ];
    const calls: Array<{ url: string; init: { method: string; headers: Record<string, string>; body: string } }> = [];
    const fetchImpl: FetchLike = async (url, init) => {
      calls.push({ url, init });
      const response = responses.length > 1 ? responses.shift()! : responses[0]!;
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
    const provider = new AnthropicProvider({
      baseUrl: "http://localhost:1234",
      fetchImpl,
      retryBaseMs: 0,
    });

    const result = await provider.complete({ model: "claude-opus-5", messages: [] });

    expect(calls).toHaveLength(2);
    expect(result.text).toBe("recovered");
  });
});
