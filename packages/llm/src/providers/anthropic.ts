import type { LLMProvider, ProviderRequest, CompletionResult } from "../types.js";
import type { FetchLike } from "./openai-compatible.js";

export interface AnthropicProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  name?: string;
  maxTokens?: number;
  fetchImpl?: FetchLike;
}

/**
 * Talks to the real Anthropic Messages API via raw `fetch` — no `@anthropic-ai/sdk`, so
 * `@flow/llm` stays dependency-free. Anthropic's wire shape differs from the OpenAI-compatible
 * one: system prompt is a top-level field (not a `system`-role message), `max_tokens` is
 * required, and auth is `x-api-key` rather than a bearer token.
 */
export class AnthropicProvider implements LLMProvider {
  readonly name: string;
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly maxTokens: number;
  private readonly fetchImpl: FetchLike;

  constructor(options: AnthropicProviderOptions = {}) {
    this.name = options.name ?? "anthropic";
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://api.anthropic.com/v1").replace(/\/+$/, "");
    this.maxTokens = options.maxTokens ?? 4096;
    this.fetchImpl = options.fetchImpl ?? resolveGlobalFetch();
  }

  async complete(req: ProviderRequest): Promise<CompletionResult> {
    const system = req.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const convo = req.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));

    const body: Record<string, unknown> = {
      model: req.model,
      max_tokens: req.maxTokens ?? this.maxTokens,
      messages: convo,
    };
    if (system !== "") body["system"] = system;
    if (req.temperature !== undefined) body["temperature"] = req.temperature;

    const headers: Record<string, string> = {
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
    };
    if (this.apiKey !== undefined) headers["x-api-key"] = this.apiKey;

    const res = await this.fetchImpl(`${this.baseUrl}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`LLM request failed ${res.status}: ${await res.text()}`);
    }

    const json = await res.json();
    const text = (json.content ?? [])
      .filter((b: { type?: string }) => b?.type === "text")
      .map((b: { text: string }) => b.text)
      .join("");
    const model = json.model ?? req.model;
    const usage = {
      inputTokens: json.usage?.input_tokens,
      outputTokens: json.usage?.output_tokens,
    };
    return { text, model, provider: this.name, usage };
  }
}

function resolveGlobalFetch(): FetchLike {
  const globalFetch = (globalThis as unknown as { fetch?: FetchLike }).fetch;
  if (globalFetch === undefined) {
    throw new Error("no global fetch available; pass fetchImpl explicitly");
  }
  return globalFetch;
}
