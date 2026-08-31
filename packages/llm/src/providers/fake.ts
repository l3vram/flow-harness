import type { LLMProvider, ProviderRequest, CompletionResult, Message } from "../types.js";

/** Word count: trimmed, split on runs of whitespace; empty string counts as zero words. */
function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

export interface FakeProviderOptions {
  name?: string;
  responder?: (req: ProviderRequest) => string;
}

/**
 * Deterministic, offline provider. Default behavior echoes the last user message back so tests
 * (and dry runs of the harness) never need network access or an API key.
 */
export class FakeProvider implements LLMProvider {
  readonly name: string;
  private readonly responder: (req: ProviderRequest) => string;

  constructor(options: FakeProviderOptions = {}) {
    this.name = options.name ?? "fake";
    this.responder = options.responder ?? defaultResponder;
  }

  async complete(req: ProviderRequest): Promise<CompletionResult> {
    const text = this.responder(req);
    const inputTokens = req.messages.reduce((sum, m) => sum + wordCount(m.content), 0);
    return {
      text,
      model: req.model,
      provider: this.name,
      usage: { inputTokens, outputTokens: wordCount(text) },
    };
  }
}

function lastUserMessage(messages: Message[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m !== undefined && m.role === "user") return m.content;
  }
  return "";
}

function defaultResponder(req: ProviderRequest): string {
  return `[fake:${req.model}] ${lastUserMessage(req.messages)}`.trim();
}
