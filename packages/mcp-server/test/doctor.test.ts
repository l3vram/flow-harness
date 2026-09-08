import { describe, expect, it } from "vitest";
import { runDoctor } from "../src/index.js";

describe("flow-mcp doctor", () => {
  it("empty env: tiers are fake (warn), tools wired, overall ok", () => {
    const r = runDoctor({});
    expect(r.ok).toBe(true); // warns do not fail
    expect(r.checks.find((c) => c.name === "llm:opus")?.status).toBe("warn");
    expect(r.checks.find((c) => c.name === "tools")?.status).toBe("ok");
    expect(r.checks.find((c) => c.name === "node")?.status).toBe("ok");
  });

  it("real provider without a key fails that tier and the overall report", () => {
    const r = runDoctor({ FLOW_LLM_OPUS_PROVIDER: "anthropic" });
    expect(r.checks.find((c) => c.name === "llm:opus")?.status).toBe("fail");
    expect(r.ok).toBe(false);
  });

  it("real provider with a key passes that tier", () => {
    const r = runDoctor({ FLOW_LLM_OPUS_PROVIDER: "anthropic", FLOW_LLM_OPUS_API_KEY: "x" });
    expect(r.checks.find((c) => c.name === "llm:opus")?.status).toBe("ok");
  });

  it("blanket FLOW_LLM_API_KEY satisfies a tier with a real provider", () => {
    const r = runDoctor({ FLOW_LLM_PROVIDER: "groq", FLOW_LLM_API_KEY: "x" });
    expect(r.checks.find((c) => c.name === "llm:haiku")?.status).toBe("ok");
  });

  it("node older than 22 fails the node check and the overall report", () => {
    const r = runDoctor({}, { nodeVersion: "20.11.0" });
    expect(r.checks.find((c) => c.name === "node")?.status).toBe("fail");
    expect(r.ok).toBe(false);
  });

  it("node >= 22 passes the node check", () => {
    const r = runDoctor({}, { nodeVersion: "22.0.0" });
    expect(r.checks.find((c) => c.name === "node")?.status).toBe("ok");
  });
});