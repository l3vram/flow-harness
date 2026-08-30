import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { tools, type ToolContext } from "./tools.js";

const NAME = "flow-harness";
const VERSION = "0.1.0";

/**
 * Build an MCP server that exposes the flow runtime as `flow_*` tools. The tool logic lives in
 * tools.ts; this only maps the protocol's list/call requests onto those handlers. Errors are
 * returned as tool results with `isError: true` rather than thrown, per the MCP convention.
 */
export function createServer(ctx: ToolContext): Server {
  const server = new Server({ name: NAME, version: VERSION }, { capabilities: { tools: {} } });

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
      const result = tool.handler(ctx, request.params.arguments ?? {});
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
