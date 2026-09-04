import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FakeProvider, ModelRouter } from "@flow/llm";
import { Executor } from "../src/index.js";

function routerWithResponse(text: string): ModelRouter {
  const provider = new FakeProvider({ responder: () => text });
  return new ModelRouter(
    new Map([[provider.name, provider]]),
    [{ tier: "sonnet", provider: provider.name, model: "m" }],
    "sonnet",
  );
}

describe("Executor", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "flow-executor-run-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes files and reports a passing verify", async () => {
    const text = "<<<FILE hello.txt>>>\nhi\n<<<END>>>\n<<<REASON>>> done";
    const router = routerWithResponse(text);
    const executor = new Executor(router, { verifyCommand: ["node", "-e", "process.exit(0)"] });

    const result = await executor.run(
      { id: "t1", instruction: "write hello.txt" },
      { targetDir: dir },
    );

    expect(result.taskId).toBe("t1");
    expect(result.files).toEqual(["hello.txt"]);
    expect(readFileSync(join(dir, "hello.txt"), "utf8")).toBe("hi");
    expect(result.reason).toBe("done");
    expect(result.verify.ok).toBe(true);
  });

  it("reports a failing verify", async () => {
    const text = "<<<FILE hello.txt>>>\nhi\n<<<END>>>\n<<<REASON>>> done";
    const router = routerWithResponse(text);
    const executor = new Executor(router, { verifyCommand: ["node", "-e", "process.exit(1)"] });

    const result = await executor.run(
      { id: "t1", instruction: "write hello.txt" },
      { targetDir: dir },
    );

    expect(result.verify.ok).toBe(false);
  });

  it("ctx.verifyCommand overrides the constructor's verifyCommand", async () => {
    const text = "<<<FILE hello.txt>>>\nhi\n<<<END>>>\n<<<REASON>>> done";
    const router = routerWithResponse(text);
    const executor = new Executor(router, { verifyCommand: ["node", "-e", "process.exit(0)"] });

    const result = await executor.run(
      { id: "t1", instruction: "write hello.txt" },
      { targetDir: dir, verifyCommand: ["node", "-e", "process.exit(1)"] },
    );

    expect(result.verify.ran).toBe(true);
    expect(result.verify.ok).toBe(false);
  });

  it("turns an apply failure into a failed verify (no throw) so the repair loop can retry", async () => {
    writeFileSync(join(dir, "hello.txt"), "hi there", "utf8");
    const text = [
      "<<<EDIT hello.txt>>>",
      "<<<SEARCH>>>",
      "text that is not present",
      "<<<REPLACE>>>",
      "whatever",
      "<<<END>>>",
      "<<<REASON>>> tried an edit",
    ].join("\n");
    const router = routerWithResponse(text);
    const executor = new Executor(router, { verifyCommand: ["node", "-e", "process.exit(0)"] });

    const result = await executor.run(
      { id: "t3", instruction: "edit hello.txt" },
      { targetDir: dir },
    );

    expect(result.files).toEqual([]);
    expect(result.verify.ok).toBe(false);
    expect(result.verify.output).toContain("apply failed");
    expect(result.verify.output).toContain("search text not found");
    // the current file content is surfaced so a repair retry can craft a matching edit
    expect(result.verify.output).toContain("hi there");
    // the file on disk is left untouched
    expect(readFileSync(join(dir, "hello.txt"), "utf8")).toBe("hi there");
  });

  it("edits an existing file via an EDIT block", async () => {
    writeFileSync(join(dir, "hello.txt"), "hi there", "utf8");
    const text = [
      "<<<EDIT hello.txt>>>",
      "<<<SEARCH>>>",
      "hi there",
      "<<<REPLACE>>>",
      "hi world",
      "<<<END>>>",
      "<<<REASON>>> edited it",
    ].join("\n");
    const router = routerWithResponse(text);
    const executor = new Executor(router, {});

    const result = await executor.run(
      { id: "t2", instruction: "edit hello.txt" },
      { targetDir: dir },
    );

    expect(result.taskId).toBe("t2");
    expect(result.files).toEqual(["hello.txt"]);
    expect(readFileSync(join(dir, "hello.txt"), "utf8")).toBe("hi world");
    expect(result.reason).toBe("edited it");
    expect(result.verify.ran).toBe(false);
  });
});
