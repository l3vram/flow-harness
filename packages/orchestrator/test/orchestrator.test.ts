import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Runtime } from "@flow/core";
import { Ceo } from "@flow/ceo";
import { Executor } from "@flow/executor";
import { FakeProvider, ModelRouter, type ProviderRequest } from "@flow/llm";
import { Orchestrator, type TaskSpec } from "../src/index.js";

/** A scripted responder: replies with each response in order, repeating the last once exhausted. */
function scripted(responses: string[]): (req: ProviderRequest) => string {
  let i = 0;
  return () => {
    const idx = Math.min(i, responses.length - 1);
    i++;
    const r = responses[idx];
    return r ?? "";
  };
}

/** A ModelRouter whose provider scripts a sequence of CEO decision JSON strings, in order. */
function ceoRouter(actions: string[]): ModelRouter {
  const responses = actions.map((action) =>
    JSON.stringify({ action, taskIds: [], reason: "r", confidence: 0.9 }),
  );
  const provider = new FakeProvider({ responder: scripted(responses) });
  return new ModelRouter(new Map([[provider.name, provider]]), [{ tier: "opus", provider: provider.name, model: "m" }], "opus");
}

/** A ModelRouter whose provider always returns the given file changes as executor block text. */
function execRouter(files: { path: string; content: string }[]): ModelRouter {
  const text =
    files.map((f) => "<<<FILE " + f.path + ">>>\n" + f.content + "\n<<<END>>>").join("\n") +
    "\n<<<REASON>>> done";
  const provider = new FakeProvider({ responder: () => text });
  return new ModelRouter(new Map([[provider.name, provider]]), [{ tier: "sonnet", provider: provider.name, model: "m" }], "sonnet");
}

/** A ModelRouter whose provider scripts a sequence of raw executor block-text responses, in order. */
function scriptedExecRouter(responses: string[]): ModelRouter {
  const provider = new FakeProvider({ responder: scripted(responses) });
  return new ModelRouter(new Map([[provider.name, provider]]), [{ tier: "sonnet", provider: provider.name, model: "m" }], "sonnet");
}

describe("Orchestrator", () => {
  let runDir: string;
  let targetDir: string;

  beforeEach(() => {
    runDir = mkdtempSync(join(tmpdir(), "flow-orch-run-"));
    targetDir = mkdtempSync(join(tmpdir(), "flow-orch-target-"));
  });

  afterEach(() => {
    rmSync(runDir, { recursive: true, force: true });
    rmSync(targetDir, { recursive: true, force: true });
  });

  it("happy path: two tasks (b deps a) both go green and the run completes", async () => {
    const runtime = Runtime.init(runDir, "r1", "obj");
    runtime.addTask("a", "backend", "sonnet", []);
    runtime.addTask("b", "backend", "sonnet", ["a"]);

    const specs = new Map<string, TaskSpec>([
      ["a", { id: "a", role: "backend", tier: "sonnet", deps: [], instruction: "do a" }],
      ["b", { id: "b", role: "backend", tier: "sonnet", deps: ["a"], instruction: "do b" }],
    ]);

    const ceo = new Ceo(runtime, ceoRouter(["dispatch", "advance", "dispatch", "complete"]));
    const executor = new Executor(execRouter([{ path: "out.txt", content: "x" }]), {});

    const orchestrator = new Orchestrator(runtime, ceo, executor, specs, { targetDir });
    const report = await orchestrator.run();

    expect(report.completed).toBe(true);
    expect(report.outcomes.a?.status).toBe("green");
    expect(report.outcomes.b?.status).toBe("green");
    expect(report.outcomes.a?.attempts).toBe(1);
    expect(report.outcomes.b?.attempts).toBe(1);
    expect(existsSync(join(targetDir, "out.txt"))).toBe(true);
    expect(readFileSync(join(targetDir, "out.txt"), "utf8")).toBe("x");
  });

  it("verify failure blocks a task and the run does not complete", async () => {
    const runtime = Runtime.init(runDir, "r2", "obj");
    runtime.addTask("a", "backend", "sonnet", []);

    const specs = new Map<string, TaskSpec>([
      ["a", { id: "a", role: "backend", tier: "sonnet", deps: [], instruction: "do a" }],
    ]);

    const ceo = new Ceo(runtime, ceoRouter(["dispatch", "await_human"]));
    const executor = new Executor(execRouter([{ path: "out.txt", content: "x" }]), {
      verifyCommand: ["node", "-e", "process.exit(1)"],
    });

    const orchestrator = new Orchestrator(runtime, ceo, executor, specs, { targetDir });
    const report = await orchestrator.run();

    expect(report.completed).toBe(false);
    expect(report.outcomes.a?.status).toBe("blocked");
    expect(report.outcomes.a?.verify.ok).toBe(false);
  });

  it("a ready task with no matching spec is marked blocked safely, without throwing", async () => {
    const runtime = Runtime.init(runDir, "r3", "obj");
    runtime.addTask("a", "backend", "sonnet", []);

    const specs = new Map<string, TaskSpec>(); // no spec for "a"

    const ceo = new Ceo(runtime, ceoRouter(["dispatch", "await_human"]));
    const executor = new Executor(execRouter([{ path: "out.txt", content: "x" }]), {});

    const orchestrator = new Orchestrator(runtime, ceo, executor, specs, { targetDir });
    const report = await orchestrator.run();

    expect(report.outcomes.a?.status).toBe("blocked");
    expect(report.outcomes.a?.reason).toBe("no task spec");
  });

  it("a high-risk change that passes verify goes to review, not green", async () => {
    const runtime = Runtime.init(runDir, "r4", "obj");
    runtime.addTask("a", "backend", "sonnet", []);

    const specs = new Map<string, TaskSpec>([
      ["a", { id: "a", role: "backend", tier: "sonnet", deps: [], instruction: "touch auth" }],
    ]);

    const ceo = new Ceo(runtime, ceoRouter(["dispatch", "await_human"]));
    const executor = new Executor(
      execRouter([
        { path: "auth.ts", content: "x" },
        { path: "b.ts", content: "y" },
        { path: "c.ts", content: "z" },
      ]),
      {},
    );

    const orchestrator = new Orchestrator(runtime, ceo, executor, specs, { targetDir });
    const report = await orchestrator.run();

    expect(report.outcomes.a?.status).toBe("review");
    expect(report.outcomes.a?.risk?.level).toBe("high");
  });

  const verifyGood = [
    "node",
    "-e",
    "const fs=require('node:fs');process.exit(fs.readFileSync('out.txt','utf8').trim()==='GOOD'?0:1)",
  ];

  it("repair succeeds: a failing task is retried and passes on the second attempt", async () => {
    const runtime = Runtime.init(runDir, "r5", "obj");
    runtime.addTask("a", "backend", "sonnet", []);

    const specs = new Map<string, TaskSpec>([
      ["a", { id: "a", role: "backend", tier: "sonnet", deps: [], instruction: "do a" }],
    ]);

    const ceo = new Ceo(runtime, ceoRouter(["dispatch", "await_human"]));
    const executor = new Executor(
      scriptedExecRouter(["<<<FILE out.txt>>>\nBAD\n<<<END>>>", "<<<FILE out.txt>>>\nGOOD\n<<<END>>>"]),
      { verifyCommand: verifyGood },
    );

    const orchestrator = new Orchestrator(runtime, ceo, executor, specs, { targetDir });
    const report = await orchestrator.run();

    expect(report.outcomes.a?.status).toBe("green");
    expect(report.outcomes.a?.attempts).toBe(2);
  });

  it("repair recovers from an apply failure: a bad EDIT no longer aborts the run — it is retried and a valid write passes", async () => {
    const runtime = Runtime.init(runDir, "r5b", "obj");
    runtime.addTask("a", "backend", "sonnet", []);

    const specs = new Map<string, TaskSpec>([
      ["a", { id: "a", role: "backend", tier: "sonnet", deps: [], instruction: "do a" }],
    ]);

    // The file exists, but attempt 1's EDIT searches for text that is absent → apply throws inside
    // the executor. Before the fix this aborted the whole run; now it becomes a failed verify that
    // the repair loop feeds back, and attempt 2's valid write passes.
    writeFileSync(join(targetDir, "out.txt"), "placeholder", "utf8");
    const badEdit = ["<<<EDIT out.txt>>>", "<<<SEARCH>>>", "text that is absent", "<<<REPLACE>>>", "GOOD", "<<<END>>>"].join("\n");
    const goodWrite = "<<<FILE out.txt>>>\nGOOD\n<<<END>>>";

    const ceo = new Ceo(runtime, ceoRouter(["dispatch", "await_human"]));
    const executor = new Executor(scriptedExecRouter([badEdit, goodWrite]), { verifyCommand: verifyGood });

    const orchestrator = new Orchestrator(runtime, ceo, executor, specs, { targetDir });
    const report = await orchestrator.run();

    expect(report.outcomes.a?.status).toBe("green");
    expect(report.outcomes.a?.attempts).toBe(2);
    expect(readFileSync(join(targetDir, "out.txt"), "utf8").trim()).toBe("GOOD");
  });

  it("QA-verified task: passing criteria -> green with a QA report attached", async () => {
    const runtime = Runtime.init(runDir, "rqa1", "obj");
    runtime.addTask("a", "backend", "sonnet", []);

    const specs = new Map<string, TaskSpec>([
      ["a", { id: "a", role: "backend", tier: "sonnet", deps: [], instruction: "do a", criteria: [{ id: "c1", description: "exits 0", verify: ["node", "-e", "process.exit(0)"] }] }],
    ]);

    const ceo = new Ceo(runtime, ceoRouter(["dispatch", "await_human"]));
    const executor = new Executor(execRouter([{ path: "out.txt", content: "x" }]), {});

    const orchestrator = new Orchestrator(runtime, ceo, executor, specs, { targetDir });
    const report = await orchestrator.run();

    expect(report.outcomes.a?.status).toBe("green");
    expect(report.outcomes.a?.qa?.complete).toBe(true);
    expect(report.outcomes.a?.attempts).toBe(1);
  });

  it("QA-verified task: a failing criterion -> blocked with tickets, run does not complete", async () => {
    const runtime = Runtime.init(runDir, "rqa2", "obj");
    runtime.addTask("a", "backend", "sonnet", []);

    const specs = new Map<string, TaskSpec>([
      ["a", { id: "a", role: "backend", tier: "sonnet", deps: [], instruction: "do a", criteria: [{ id: "c1", description: "must exit 0", verify: ["node", "-e", "process.exit(1)"], severity: "critical" }] }],
    ]);

    const ceo = new Ceo(runtime, ceoRouter(["dispatch", "await_human"]));
    const executor = new Executor(execRouter([{ path: "out.txt", content: "x" }]), {});

    const orchestrator = new Orchestrator(runtime, ceo, executor, specs, { targetDir });
    const report = await orchestrator.run();

    expect(report.completed).toBe(false);
    expect(report.outcomes.a?.status).toBe("blocked");
    expect(report.outcomes.a?.qa?.complete).toBe(false);
    const tickets = report.outcomes.a?.qa?.criteria.flatMap((c) => c.tickets) ?? [];
    expect(tickets.length).toBeGreaterThan(0);
    expect(tickets[0]?.severity).toBe("critical");
  });

  it("repair budget exhausted: a task that never passes verify stays blocked after the max tries", async () => {
    const runtime = Runtime.init(runDir, "r6", "obj");
    runtime.addTask("a", "backend", "sonnet", []);

    const specs = new Map<string, TaskSpec>([
      ["a", { id: "a", role: "backend", tier: "sonnet", deps: [], instruction: "do a" }],
    ]);

    const ceo = new Ceo(runtime, ceoRouter(["dispatch", "await_human"]));
    const executor = new Executor(execRouter([{ path: "out.txt", content: "BAD" }]), {
      verifyCommand: verifyGood,
    });

    const orchestrator = new Orchestrator(runtime, ceo, executor, specs, { targetDir });
    const report = await orchestrator.run();

    expect(report.outcomes.a?.status).toBe("blocked");
    expect(report.outcomes.a?.attempts).toBe(3);
  });

  it("a per-task verify overrides the constructor's (empty) verifyCommand and blocks on failure", async () => {
    const runtime = Runtime.init(runDir, "r7", "obj");
    runtime.addTask("a", "backend", "sonnet", []);

    const specs = new Map<string, TaskSpec>([
      [
        "a",
        {
          id: "a",
          role: "backend",
          tier: "sonnet",
          deps: [],
          instruction: "do a",
          verify: ["node", "-e", "process.exit(1)"],
        },
      ],
    ]);

    const ceo = new Ceo(runtime, ceoRouter(["dispatch", "await_human"]));
    const executor = new Executor(execRouter([{ path: "out.txt", content: "x" }]), {});

    const orchestrator = new Orchestrator(runtime, ceo, executor, specs, { targetDir });
    const report = await orchestrator.run();

    expect(report.outcomes.a?.status).toBe("blocked");
    expect(report.outcomes.a?.verify.ok).toBe(false);
  });
});
