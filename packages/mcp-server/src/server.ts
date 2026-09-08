import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { tools, type ToolContext } from "./tools.js";

const NAME = "flow-harness";
const VERSION = "0.1.0";

/**
 * Usage guidance handed to the MCP host (returned in the `initialize` result as `instructions`), so
 * the host's model can drive `flow_run` correctly without the user hand-writing tool parameters.
 */
export const SERVER_INSTRUCTIONS = [
  "flow-harness turns an objective into verified changes on a repo: plan -> implement -> QA (evidence) -> report.",
  "",
  "To add or build a feature in a repo, call the `flow_run` tool:",
  "- `targetDir` (required): the ABSOLUTE path of the repo to change.",
  "- `objective`: what to build, in one sentence.",
  "- Review-first: call once WITHOUT `acceptPlan` to get the plan back as 'plan pending', then call again with `acceptPlan:true` to execute. (Or pass explicit `tasks` to skip the planner.)",
  "- Prefer an explicit `verifyCommand` over auto-derived criteria, which can be over-strict and block a correct result. For Android use Gradle, e.g. [\"./gradlew\",\":app:testDebugUnitTest\"], and set `deriveCriteria:false`.",
  "- Set `worktree:true` to run on an isolated `flow/<runId>` branch of the repo (recommended); the report returns `branch` and `worktreeDir` to review. Without it, flow writes into the working tree directly.",
  "- Evidence lands under <FLOW_HOME>/runs/<runId>/evidence/.",
  "Limit: Android UI/device QA is not built yet — only logic covered by Gradle unit tests is objectively verified.",
].join("\n");

/**
 * Build an MCP server that exposes the flow runtime as `flow_*` tools. The tool logic lives in
 * tools.ts; this only maps the protocol's list/call requests onto those handlers. Errors are
 * returned as tool results with `isError: true` rather than thrown, per the MCP convention.
 */
export function createServer(ctx: ToolContext): Server {
  const server = new Server(
    { name: NAME, version: VERSION },
    { capabilities: { tools: {} }, instructions: SERVER_INSTRUCTIONS },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find((t) => t.name === request.params.name);
    if (!tool) {
      return { content: [{ type: "text", text: `unknown tool: ${request.params.name}` }], isError: true };
    }
    try {
      const result = await tool.handler(ctx, request.params.arguments ?? {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: (error as Error).message }], isError: true };
    }
  });

  return server;
}

/** Start the server over stdio. `FLOW_HOME` sets the base directory for runs (default `.flow`). */
export async function main(): Promise<void> {
  const baseDir = process.env.FLOW_HOME ?? ".flow";
  const server = createServer({ baseDir });
  await server.connect(new StdioServerTransport());
}
