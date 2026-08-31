import { describe, expect, it } from "vitest";
import { FakeProvider } from "../src/index.js";

describe("FakeProvider", () => {
  it("echoes the last user message by default", async () => {
    const provider = new FakeProvider();
    const result = await provider.complete({
      model: "fake-sonnet",
      messages: [
        { role: "system", content: "be terse" },
        { role: "user", content: "hello there" },
        { role: "assistant", content: "hi" },
        { role: "user", content: "what is up" },
      ],
    });
    expect(result.text).toBe("[fake:fake-sonnet] what is up");
    expect(result.model).toBe("fake-sonnet");
    expect(result.provider).toBe("fake");
  });

  it("returns an empty last-user-message when there is none", async () => {
    const provider = new FakeProvider();
    const result = await provider.complete({
      model: "m",
      messages: [{ role: "system", content: "only system" }],
    });
    expect(result.text).toBe("[fake:m]");
  });

  it("computes deterministic word-count usage", async () => {
    const provider = new FakeProvider();
    const result = await provider.complete({
      model: "m",
      messages: [
        { role: "system", content: "one two three" },
        { role: "user", content: "four five" },
      ],
    });
    // input = 3 + 2 = 5 words; output = word count of "[fake:m] four five" = 3
    expect(result.usage.inputTokens).toBe(5);
    expect(result.usage.outputTokens).toBe(3);
  });

  it("supports a scripted responder and custom name", async () => {
    const provider = new FakeProvider({
      name: "scripted",
      responder: (req) => `scripted:${req.model}`,
    });
    const result = await provider.complete({ model: "m", messages: [] });
    expect(result.text).toBe("scripted:m");
    expect(result.provider).toBe("scripted");
    expect(result.usage.inputTokens).toBe(0);
    expect(result.usage.outputTokens).toBe(1);
  });
});
