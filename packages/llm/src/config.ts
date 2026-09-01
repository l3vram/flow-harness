import { AnthropicProvider } from "./providers/anthropic.js";
import { FakeProvider } from "./providers/fake.js";
import { OpenAICompatibleProvider } from "./providers/openai-compatible.js";
import { ModelRouter } from "./router.js";
import type { LLMProvider, ModelProfile, Tier } from "./types.js";

const TIERS: Tier[] = ["haiku", "sonnet", "opus"];

interface ProviderConfig {
  apiKey: string | undefined;
  baseUrl: string | undefined;
  maxRetries: number | undefined;
}

/**
 * Builds the concrete provider instance for a given `kind`, given the resolved per-tier (or
 * global-fallback) credentials/endpoint.
 */
function makeProvider(kind: string, { apiKey, baseUrl, maxRetries }: ProviderConfig): LLMProvider {
  if (kind === "fake") {
    return new FakeProvider();
  }
  if (kind === "openai" || kind === "openai-compatible") {
    if (!baseUrl) {
      throw new Error("FLOW_LLM_BASE_URL is required when the provider is 'openai'");
    }
    return new OpenAICompatibleProvider({ baseUrl, apiKey, maxRetries });
  }
  if (kind === "anthropic") {
    return new AnthropicProvider({ apiKey, baseUrl, maxRetries });
  }
  throw new Error(`unknown provider '${kind}' (use 'fake', 'openai', or 'anthropic')`);
}

/** Default model for a tier, per provider kind — used when no explicit model env is set. */
function defaultModel(kind: string, tier: Tier): string {
  if (kind === "fake") return "fake-" + tier;
  if (kind === "openai" || kind === "openai-compatible") return "gpt-4o-mini";
  if (kind === "anthropic") {
    const byTier: Record<string, string> = {
      haiku: "claude-haiku-4-5",
      sonnet: "claude-sonnet-5",
      opus: "claude-opus-5",
    };
    return byTier[tier] ?? "claude-sonnet-5";
  }
  return "fake-" + tier;
}

/**
 * Builds a `ModelRouter` from environment variables, so the harness (and its Docker services)
 * can switch providers without a code change. Each tier (`haiku`/`sonnet`/`opus`) can be
 * configured independently via `FLOW_LLM_<TIER>_*` env vars, falling back to the blanket
 * `FLOW_LLM_*` vars, and finally to the offline `FakeProvider`. This lets e.g. the CEO tier
 * (`opus`) run on Anthropic while execution tiers run on a different (or the same) backend.
 *
 * Uses `||`, not `??`, for every fallback, so an empty string — e.g. Docker Compose's
 * `${FLOW_LLM_MODEL:-}` default — is treated as unset rather than blanking the value.
 */
export function routerFromEnv(env: NodeJS.ProcessEnv = process.env): ModelRouter {
  const providers = new Map<string, LLMProvider>();
  const profiles: ModelProfile[] = [];
  const maxRetries = env.FLOW_LLM_MAX_RETRIES ? Number(env.FLOW_LLM_MAX_RETRIES) : undefined;

  for (const tier of TIERS) {
    const u = tier.toUpperCase();
    const kind = (env["FLOW_LLM_" + u + "_PROVIDER"] || env.FLOW_LLM_PROVIDER || "fake").toLowerCase();
    const apiKey = env["FLOW_LLM_" + u + "_API_KEY"] || env.FLOW_LLM_API_KEY || undefined;
    const baseUrl = env["FLOW_LLM_" + u + "_BASE_URL"] || env.FLOW_LLM_BASE_URL || undefined;
    const model =
      env["FLOW_LLM_" + u + "_MODEL"] ||
      env["FLOW_LLM_MODEL_" + u] ||
      env.FLOW_LLM_MODEL ||
      defaultModel(kind, tier);

    const provider = makeProvider(kind, { apiKey, baseUrl, maxRetries });
    providers.set(tier, provider);
    profiles.push({ tier, provider: tier, model });
  }

  return new ModelRouter(providers, profiles);
}
