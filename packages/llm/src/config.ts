import { FakeProvider } from "./providers/fake.js";
import { OpenAICompatibleProvider } from "./providers/openai-compatible.js";
import { ModelRouter } from "./router.js";
import type { LLMProvider, ModelProfile, Tier } from "./types.js";

const TIERS: Tier[] = ["haiku", "sonnet", "opus"];

/**
 * `FLOW_LLM_MODEL_<TIER>` wins over the blanket `FLOW_LLM_MODEL`, else falls back. Uses `||`,
 * not `??`, so an empty string — e.g. Docker Compose's `${FLOW_LLM_MODEL:-}` default — is
 * treated as unset and falls through rather than blanking the model.
 */
function modelFor(env: NodeJS.ProcessEnv, tier: Tier, fallback: string): string {
  return env["FLOW_LLM_MODEL_" + tier.toUpperCase()] || env.FLOW_LLM_MODEL || fallback;
}

/**
 * Builds a `ModelRouter` from environment variables, so the harness (and its Docker services)
 * can switch providers without a code change. Defaults to the offline `FakeProvider` — a real
 * backend is opt-in via `FLOW_LLM_PROVIDER`.
 */
export function routerFromEnv(env: NodeJS.ProcessEnv = process.env): ModelRouter {
  // `||` so an empty FLOW_LLM_PROVIDER (the compose default) is treated as unset → "fake".
  const kind = (env.FLOW_LLM_PROVIDER || "fake").toLowerCase();
  const providers = new Map<string, LLMProvider>();
  let profiles: ModelProfile[];

  if (kind === "fake") {
    const provider = new FakeProvider();
    providers.set(provider.name, provider);
    profiles = TIERS.map((tier) => ({
      tier,
      provider: provider.name,
      model: modelFor(env, tier, "fake-" + tier),
    }));
  } else if (kind === "openai" || kind === "openai-compatible") {
    const baseUrl = env.FLOW_LLM_BASE_URL;
    if (!baseUrl) {
      throw new Error("FLOW_LLM_BASE_URL is required when FLOW_LLM_PROVIDER is 'openai'");
    }
    // Treat an empty FLOW_LLM_API_KEY (e.g. the compose default) as "no key" so keyless local
    // endpoints (Ollama, LM Studio, vLLM) don't receive a bogus `Authorization: Bearer ` header.
    const provider = new OpenAICompatibleProvider({ baseUrl, apiKey: env.FLOW_LLM_API_KEY || undefined });
    providers.set(provider.name, provider);
    profiles = TIERS.map((tier) => ({
      tier,
      provider: provider.name,
      model: modelFor(env, tier, "gpt-4o-mini"),
    }));
  } else {
    throw new Error(`unknown FLOW_LLM_PROVIDER '${kind}' (use 'fake' or 'openai')`);
  }

  return new ModelRouter(providers, profiles);
}
