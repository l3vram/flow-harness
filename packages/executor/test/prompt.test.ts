import { describe, expect, it } from "vitest";
import { buildExecutorMessages } from "../src/index.js";

const BASE_START = "You are an implementation executor";

describe("buildExecutorMessages conventions", () => {
  it("no conventions: the system message is just the base prompt", () => {
    const [sys] = buildExecutorMessages({ id: "t", instruction: "do x" }, "");
    expect(sys.role).toBe("system");
    expect(sys.content.startsWith(BASE_START)).toBe(true);
    expect(sys.content).not.toMatch(/PROJECT RULES/);
  });

  it("conventions are appended to the system message as hard rules, base prompt still first", () => {
    const [sys, user] = buildExecutorMessages(
      { id: "t", instruction: "do x" },
      "",
      "NO Hilt/Dagger. Tests are JUnit4, not kotlin.test. Never bump dependency versions.",
    );
    expect(sys.content.startsWith(BASE_START)).toBe(true); // cache prefix preserved
    expect(sys.content).toMatch(/PROJECT RULES/);
    expect(sys.content).toMatch(/NO Hilt\/Dagger\./);
    expect(sys.content).toMatch(/JUnit4/);
    expect(user.content).toContain("do x");
  });

  it("blank/whitespace conventions are ignored", () => {
    const [sys] = buildExecutorMessages({ id: "t", instruction: "do x" }, "", "   \n  ");
    expect(sys.content).not.toMatch(/PROJECT RULES/);
  });
});
