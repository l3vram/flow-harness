/**
 * Provider-neutral inference types. Nothing here depends on a vendor SDK — an `LLMProvider`
 * is just an async function from a normalized request to a normalized result, so any backend
 * (or a fully offline fake) can implement it.
 */

/** A capability/cost tier. Open string union: known tiers get autocomplete, unknown ones still work. */
export type Tier = "haiku" | "sonnet" | "opus" | (string & {});

export type MessageRole = "system" | "user" | "assistant";

export interface Message {
  role: MessageRole;
  content: string;
}

export interface Usage {
  inputTokens?: number;
  outputTokens?: number;
}

/** A caller-facing completion request: tier/model resolution happens inside the router. */
export interface CompletionRequest {
  messages: Message[];
  tier?: Tier;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface CompletionResult {
  text: string;
  model: string;
  provider: string;
  usage: Usage;
}

/** A request already normalized by the router: the model is resolved, no tier remains. */
export interface ProviderRequest {
  model: string;
  messages: Message[];
  maxTokens?: number;
  temperature?: number;
}

/** Implemented once per inference backend. */
export interface LLMProvider {
  readonly name: string;
  complete(req: ProviderRequest): Promise<CompletionResult>;
}

/** Maps a tier to a concrete provider + model, as configured by the router. */
export interface ModelProfile {
  tier: Tier;
  provider: string;
  model: string;
}
