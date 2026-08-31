import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Runtime } from "@flow/core";
import { FakeProvider, ModelRouter, type ProviderRequest } from "@flow/llm";
import { Ceo } from "../src/index.js";

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

function routerFor(responses: string[]): ModelRouter {
  const p = new FakeProvider({ responder: scripted(responses) });
  return new ModelRouter(new Map([[p.name, p]]), [{ tier: "opus", provider: p.name, model: "m" }], "opus");
}

function decisionJson(action: string): string {
  return JSON.stringify({ action, taskIds: [], reason: "r", confidence: 0.5 });
}

describe("Ceo", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "flow-ceo-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("decide() returns the parsed decision the provider scripts", async () => {
    const rt = Runtime.init(dir, "r", "obj");
    rt.addTask("a", "backend", "sonnet", []);
    const router = routerFor([decisionJson("dispatch")]);
    const ceo = new Ceo(rt, router);
    const decision = await ceo.decide();
    expect(decision.action).toBe("dispatch");
  });

  it("step() with autoApply true applies advance when the wave is done", async () => {
    const rt = Runtime.init(dir, "r", "obj");
    rt.addTask("a", "backend", "sonnet", []);
    rt.setStatus("a", "green");
    expect(rt.waveDone()).toBe(true);

    const router = routerFor([decisionJson("advance")]);
    const ceo = new Ceo(rt, router, { autoApply: true });
    const { decision, applied } = await ceo.step();

    expect(decision.action).toBe("advance");
    expect(applied).toBe(true);
    expect(rt.state.current_wave).toBe(1);
  });

  it("step() with autoApply true does not apply advance when the wave is not done", async () => {
    const rt = Runtime.init(dir, "r", "obj");
    rt.addTask("a", "backend", "sonnet", []);

    const router = routerFor([decisionJson("advance")]);
    const ceo = new Ceo(rt, router, { autoApply: true });
    const { decision, applied } = await ceo.step();

    expect(decision.action).toBe("advance");
    expect(applied).toBe(false);
    expect(rt.state.current_wave).toBe(0);
  });

  it("run() scripting dispatch returns exactly one decision and stops", async () => {
    const rt = Runtime.init(dir, "r", "obj");
    rt.addTask("a", "backend", "sonnet", []);

    const router = routerFor([decisionJson("dispatch")]);
    const ceo = new Ceo(rt, router, { autoApply: true });
    const decisions = await ceo.run();

    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.action).toBe("dispatch");
  });

  it("run() scripting advance (wave done) then complete returns two decisions", async () => {
    const rt = Runtime.init(dir, "r", "obj");
    rt.addTask("a", "backend", "sonnet", []);
    rt.setStatus("a", "green");

    const router = routerFor([decisionJson("advance"), decisionJson("complete")]);
    const ceo = new Ceo(rt, router, { autoApply: true });
    const decisions = await ceo.run();

    expect(decisions).toHaveLength(2);
    expect(decisions[0]?.action).toBe("advance");
    expect(decisions[1]?.action).toBe("complete");
  });
});
