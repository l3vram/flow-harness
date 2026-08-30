import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/index.js";

// End-to-end over the real MCP protocol, using the SDK's in-memory transport to connect a
// client and the server in-process — no child process, but the full list/call round trip.

describe("mcp server (in-memory transport)", () => {
  let baseDir: string;
  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), "flow-mcpsrv-"));
  });
  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  async function connect(): Promise<Client> {
    const server = createServer({ baseDir });
    const client = new Client({ name: "test-client", version: "0.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    return client;
  }

  const textOf = (res: { content: unknown }): string => {
    const first = (res.content as Array<{ type: string; text?: string }>)[0];
    return first?.text ?? "";
  };

  it("lists the flow_* tools with input schemas", async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain("flow_start");
    expect(names).toContain("flow_add_task");
    expect(names).toContain("flow_status");
    const start = tools.find((t) => t.name === "flow_start");
    expect(start?.inputSchema?.required).toContain("runId");
  });

  it("drives a run end to end over the protocol", async () => {
    const client = await connect();
    await client.callTool({ name: "flow_start", arguments: { runId: "r1", objective: "build an API" } });
    await client.callTool({ name: "flow_add_task", arguments: { runId: "r1", id: "api", role: "backend", tier: "sonnet" } });
    await client.callTool({ name: "flow_add_task", arguments: { runId: "r1", id: "ui", role: "frontend", tier: "haiku", deps: ["api"] } });

    const plan = JSON.parse(textOf(await client.callTool({ name: "flow_plan", arguments: { runId: "r1" } })));
    expect(plan.waves).toEqual([["api"], ["ui"]]);

    await client.callTool({ name: "flow_set", arguments: { runId: "r1", id: "api", status: "green" } });
    const state = JSON.parse(textOf(await client.callTool({ name: "flow_status", arguments: { runId: "r1" } })));
    expect(state.run).toBe("r1");
    expect(state.plans.find((p: { id: string }) => p.id === "api").status).toBe("green");
  });

  it("returns an error result for a bad call rather than throwing", async () => {
    const client = await connect();
    const res = await client.callTool({ name: "flow_ready", arguments: { runId: "ghost" } });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toMatch(/run not found/);
  });
});
