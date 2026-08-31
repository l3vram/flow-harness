import { describe, expect, it } from "vitest";
import { parseDecision } from "../src/index.js";

describe("parseDecision", () => {
  it("parses a clean JSON decision", () => {
    const d = parseDecision('{"action":"dispatch","taskIds":["a","b"],"reason":"go","confidence":0.5}');
    expect(d).toEqual({ action: "dispatch", taskIds: ["a", "b"], reason: "go", confidence: 0.5 });
  });

  it("parses a decision embedded in surrounding prose", () => {
    const d = parseDecision(
      'Sure, here is my decision:\n{"action":"complete","taskIds":[],"reason":"done","confidence":0.9}\nThanks!',
    );
    expect(d.action).toBe("complete");
    expect(d.reason).toBe("done");
  });

  it("defaults taskIds to [] when missing", () => {
    const d = parseDecision('{"action":"advance","reason":"next","confidence":0.2}');
    expect(d.taskIds).toEqual([]);
  });

  it("defaults taskIds to [] when not an array", () => {
    const d = parseDecision('{"action":"advance","taskIds":"nope","reason":"next","confidence":0.2}');
    expect(d.taskIds).toEqual([]);
  });

  it("clamps confidence above 1 down to 1", () => {
    const d = parseDecision('{"action":"complete","taskIds":[],"reason":"r","confidence":1.5}');
    expect(d.confidence).toBe(1);
  });

  it("clamps confidence below 0 up to 0", () => {
    const d = parseDecision('{"action":"complete","taskIds":[],"reason":"r","confidence":-1}');
    expect(d.confidence).toBe(0);
  });

  it("defaults a non-number confidence to 0", () => {
    const d = parseDecision('{"action":"complete","taskIds":[],"reason":"r","confidence":"high"}');
    expect(d.confidence).toBe(0);
  });

  it("throws on an unknown action", () => {
    expect(() => parseDecision('{"action":"nuke","taskIds":[],"reason":"r","confidence":0}')).toThrow(
      /invalid CEO action/,
    );
  });

  it("throws on non-JSON text", () => {
    expect(() => parseDecision("not json at all")).toThrow(/no parseable JSON decision/);
  });
});
