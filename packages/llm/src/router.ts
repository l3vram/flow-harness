import type { CompletionRequest, CompletionResult, LLMProvider, ModelProfile, Tier } from "./types.js";

/**
 * Resolves a tier to a concrete provider + model, then dispatches the completion. This is the
 * one place tier-to-model policy lives, so callers just say "sonnet" and never hardcode model
 * names.
 */
export class ModelRouter {
  constructor(
    private readonly providers: Map<string, LLMProvider>,
    private readonly profiles: ModelProfile[],
    private readonly defaultTier: Tier = "sonnet",
  ) {
    if (profiles.length === 0) {
      throw new Error("ModelRouter requires at least one model profile");
    }
  }

  /** All tiers this router has a profile for. */
  get tiers(): Tier[] {
    return this.profiles.map((p) => p.tier);
  }

  resolve(tier: Tier): { provider: LLMProvider; model: string } {
    const profile =
      this.profiles.find((p) => p.tier === tier) ??
      this.profiles.find((p) => p.tier === this.defaultTier) ??
      this.profiles[0];
    if (profile === undefined) {
      // Unreachable given the non-empty check in the constructor, but keeps the type honest.
      throw new Error(`no model profile available for tier '${tier}'`);
    }
    const provider = this.providers.get(profile.provider);
    if (provider === undefined) {
      throw new Error(`no provider registered for '${profile.provider}' (tier '${profile.tier}')`);
    }
    return { provider, model: profile.model };
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const tier = req.tier ?? this.defaultTier;
    const resolved = this.resolve(tier);
    const model = req.model ?? resolved.model;
    return resolved.provider.complete({
      model,
      messages: req.messages,
      maxTokens: req.maxTokens,
      temperature: req.temperature,
    });
  }
}
