import { describe, expect, it } from "vitest";
import {
  AnthropicProvider,
  FakeProvider,
  ModelRouter,
  OpenAICompatibleProvider,
  routerFromEnv,
} from "../src/index.js";

describe("ModelRouter", () => {
  it("throws when given no profiles", () => {
    expect(() => new ModelRouter(new Map(), [])).toThrow();
  });

  it("resolve maps a tier to its configured provider and model", () => {
    const fake = new FakeProvider();
    const router = new ModelRouter(
      new Map([[fake.name, fake]]),
      [
        { tier: "haiku", provider: "fake", model: "fake-haiku" },
        { tier: "sonnet", provider: "fake", model: "fake-sonnet" },
      ],
      "sonnet",
    );
    const resolved = router.resolve("haiku");
    expect(resolved.model).toBe("fake-haiku");
    expect(resolved.provider).toBe(fake);
    expect(router.tiers).toEqual(["haiku", "sonnet"]);
  });

  it("falls back to the default tier, then the first profile, for an unknown tier", () => {
    const fake = new FakeProvider();
    const router = new ModelRouter(
      new Map([[fake.name, fake]]),
      [{ tier: "sonnet", provider: "fake", model: "fake-sonnet" }],
      "sonnet",
    );
    expect(router.resolve("nonexistent").model).toBe("fake-sonnet");
  });

  it("throws when the profile's provider is not registered", () => {
    const router = new ModelRouter(new Map(), [{ tier: "sonnet", provider: "missing", model: "m" }]);
    expect(() => router.resolve("sonnet")).toThrow(/missing/);
  });

  it("complete resolves tier/model and delegates to the provider", async () => {
    const fake = new FakeProvider();
    const router = new ModelRouter(new Map([[fake.name, fake]]), [
      { tier: "sonnet", provider: "fake", model: "fake-sonnet" },
    ]);
    const result = await router.complete({ tier: "sonnet", messages: [{ role: "user", content: "hi" }] });
    expect(result.text).toBe("[fake:fake-sonnet] hi");
    expect(result.model).toBe("fake-sonnet");
  });
});

describe("routerFromEnv", () => {
  it("defaults to a fake-backed router when no env is set", async () => {
    const router = routerFromEnv({});
    expect(router.tiers).toEqual(["haiku", "sonnet", "opus"]);
    const result = await router.complete({ tier: "haiku", messages: [{ role: "user", content: "hi" }] });
    expect(result.provider).toBe("fake");
    expect(result.model).toBe("fake-haiku");
  });

  it("treats empty-string env vars (the compose defaults) as unset", async () => {
    const router = routerFromEnv({
      FLOW_LLM_PROVIDER: "",
      FLOW_LLM_MODEL: "",
      FLOW_LLM_API_KEY: "",
    } as NodeJS.ProcessEnv);
    const result = await router.complete({ tier: "sonnet", messages: [{ role: "user", content: "hi" }] });
    expect(result.provider).toBe("fake");
    expect(result.model).toBe("fake-sonnet");
  });

  it("builds an openai-compatible router from FLOW_LLM_* env vars", async () => {
    const router = routerFromEnv({
      FLOW_LLM_PROVIDER: "openai",
      FLOW_LLM_BASE_URL: "http://localhost:9999",
      FLOW_LLM_MODEL: "custom-model",
    } as NodeJS.ProcessEnv);
    const resolved = router.resolve("sonnet");
    expect(resolved.model).toBe("custom-model");
    expect(resolved.provider).toBeInstanceOf(OpenAICompatibleProvider);
  });

  it("throws when FLOW_LLM_PROVIDER is openai but FLOW_LLM_BASE_URL is missing", () => {
    expect(() => routerFromEnv({ FLOW_LLM_PROVIDER: "openai" } as NodeJS.ProcessEnv)).toThrow(
      /FLOW_LLM_BASE_URL/,
    );
  });

  it("throws for an unknown provider kind", () => {
    expect(() => routerFromEnv({ FLOW_LLM_PROVIDER: "bogus" } as NodeJS.ProcessEnv)).toThrow(/bogus/);
  });

  it("builds a different provider per tier from FLOW_LLM_<TIER>_* env vars", () => {
    const router = routerFromEnv({
      FLOW_LLM_OPUS_PROVIDER: "anthropic",
      FLOW_LLM_OPUS_API_KEY: "k",
      FLOW_LLM_SONNET_PROVIDER: "openai",
      FLOW_LLM_SONNET_BASE_URL: "http://x/v1",
      FLOW_LLM_HAIKU_PROVIDER: "fake",
    } as NodeJS.ProcessEnv);

    const opus = router.resolve("opus");
    expect(opus.provider).toBeInstanceOf(AnthropicProvider);
    expect(opus.model).toBe("claude-opus-5");

    const sonnet = router.resolve("sonnet");
    expect(sonnet.provider).toBeInstanceOf(OpenAICompatibleProvider);
    expect(sonnet.model).toBe("gpt-4o-mini");

    const haiku = router.resolve("haiku");
    expect(haiku.provider).toBeInstanceOf(FakeProvider);
    expect(haiku.model).toBe("fake-haiku");
  });
});
