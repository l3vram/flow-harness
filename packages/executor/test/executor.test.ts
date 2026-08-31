import { mkdtempSync, readFileSync, rmSync } from "node:fs";
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
});
