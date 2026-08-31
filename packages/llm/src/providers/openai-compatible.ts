import type { LLMProvider, ProviderRequest, CompletionResult } from "../types.js";

/** Minimal shape of `fetch` we depend on, so tests can inject a fake without a network stack. */
export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; text(): Promise<string>; json(): Promise<any> }>;

export interface OpenAICompatibleProviderOptions {
  baseUrl: string;
  apiKey?: string;
  name?: string;
  fetchImpl?: FetchLike;
}

/**
 * Talks to any OpenAI-compatible `/chat/completions` endpoint — OpenAI itself, OpenRouter,
 * Groq, Together, vLLM, LM Studio, Ollama's `/v1` shim, etc. No vendor SDK: this is the one
 * adapter that covers most of the ecosystem via the global `fetch`.
 */
export class OpenAICompatibleProvider implements LLMProvider {
  readonly name: string;
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly fetchImpl: FetchLike;

  constructor(options: OpenAICompatibleProviderOptions) {
    this.name = options.name ?? "openai-compatible";
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? resolveGlobalFetch();
  }

  async complete(req: ProviderRequest): Promise<CompletionResult> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.apiKey !== undefined) headers["authorization"] = `Bearer ${this.apiKey}`;

    const body: Record<string, unknown> = { model: req.model, messages: req.messages };
    if (req.maxTokens !== undefined) body["max_tokens"] = req.maxTokens;
    if (req.temperature !== undefined) body["temperature"] = req.temperature;

    const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`LLM request failed ${res.status}: ${await res.text()}`);
    }

    const json = await res.json();
    const text = json.choices?.[0]?.message?.content ?? "";
    const model = json.model ?? req.model;
    const usage = {
      inputTokens: json.usage?.prompt_tokens,
      outputTokens: json.usage?.completion_tokens,
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
