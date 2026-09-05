import { join } from "node:path";
import { Runtime, isStatus, type GateId, type Tier } from "@flow/core";
import { Executor } from "@flow/executor";
import { routerFromEnv, type ModelRouter } from "@flow/llm";
import { Planner, type Plan } from "@flow/planner";
import { converge } from "@flow/converge";
import { runQA, type Criterion } from "@flow/qa";

// The tool layer. Each tool is a plain object with a JSON-Schema input and a pure-ish handler
// that operates on a Runtime. Keeping the handlers here (independent of the MCP SDK) makes them
// directly unit-testable; server.ts only wires them to the protocol.

export interface ToolContext {
  /** Base directory under which runs live at `<baseDir>/runs/<runId>/`. */
  baseDir: string;
  /** Injected router (for tests); production falls back to `routerFromEnv()` at call time. */
  router?: ModelRouter;
}

export interface JsonSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

type Args = Record<string, unknown>;

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  handler: (ctx: ToolContext, args: Args) => unknown | Promise<unknown>;
}

// --- tiny, strict argument extractors (validation + typing in one) ---

function reqStr(args: Args, key: string): string {
  const v = args[key];
  if (typeof v !== "string" || v.length === 0) throw new Error(`'${key}' (non-empty string) is required`);
  return v;
}
function optStr(args: Args, key: string): string | undefined {
  const v = args[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") throw new Error(`'${key}' must be a string`);
  return v;
}
function strArray(args: Args, key: string): string[] {
  const v = args[key];
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) throw new Error(`'${key}' must be an array of strings`);
  return v as string[];
}
function optStrArray(args: Args, key: string): string[] {
  const v = args[key];
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) throw new Error(`'${key}' must be an array of strings`);
  return v as string[];
}
function reqNum(args: Args, key: string): number {
  const raw = args[key];
  const n = typeof raw === "string" ? Number(raw) : raw;
  if (typeof n !== "number" || !Number.isFinite(n)) throw new Error(`'${key}' (number) is required`);
  return n;
}

function runDir(ctx: ToolContext, runId: string): string {
  return join(ctx.baseDir, "runs", runId);
}
function open(ctx: ToolContext, args: Args): Runtime {
  const rt = new Runtime(runDir(ctx, reqStr(args, "runId")));
  if (!rt.started()) throw new Error("run not found — call flow_start first");
  return rt;
}

const runId = { runId: { type: "string", description: "Run identifier" } } as const;

export const tools: ToolDef[] = [
  {
    name: "flow_start",
    description: "Start a new run (initialise its event log). Fails if the run already exists.",
    inputSchema: {
      type: "object",
      properties: { ...runId, objective: { type: "string", description: "What the run is building" } },
      required: ["runId"],
      additionalProperties: false,
    },
    handler: (ctx, args) => {
      const id = reqStr(args, "runId");
      const objective = optStr(args, "objective") ?? "";
      const dir = runDir(ctx, id);
      if (new Runtime(dir).started()) throw new Error(`run '${id}' already exists`);
      Runtime.init(dir, id, objective);
      return { runId: id, objective, phase: "plan" };
    },
  },
  {
    name: "flow_add_task",
    description: "Register a plan/task. `deps` are ids of tasks that must go green before this one is dispatchable.",
    inputSchema: {
      type: "object",
      properties: {
        ...runId,
        id: { type: "string" },
        role: { type: "string", description: "e.g. backend, frontend, qa" },
        tier: { type: "string", description: "model tier, e.g. haiku|sonnet|opus" },
        deps: { type: "array", items: { type: "string" } },
      },
      required: ["runId", "id", "role", "tier"],
      additionalProperties: false,
    },
    handler: (ctx, args) => {
      const rt = open(ctx, args);
      const id = reqStr(args, "id");
      rt.addTask(id, reqStr(args, "role"), reqStr(args, "tier") as Tier, strArray(args, "deps"));
      return { ok: true, id };
    },
  },
  {
    name: "flow_plan",
    description: "Compute the wave layering (Kahn) and detect dependency cycles.",
    inputSchema: { type: "object", properties: { ...runId }, required: ["runId"], additionalProperties: false },
    handler: (ctx, args) => open(ctx, args).waves(),
  },
  {
    name: "flow_ready",
    description: "List task ids dispatchable right now: in the current wave, pending, all deps green.",
    inputSchema: { type: "object", properties: { ...runId }, required: ["runId"], additionalProperties: false },
    handler: (ctx, args) => ({ ready: open(ctx, args).ready() }),
  },
  {
    name: "flow_set",
    description: "Transition a task: pending|running|review|green|blocked. Enforces the 3-attempt circuit breaker.",
    inputSchema: {
      type: "object",
      properties: {
        ...runId,
        id: { type: "string" },
        status: { type: "string", enum: ["pending", "running", "review", "green", "blocked"] },
        reason: { type: "string" },
      },
      required: ["runId", "id", "status"],
      additionalProperties: false,
    },
    handler: (ctx, args) => {
      const rt = open(ctx, args);
      const status = reqStr(args, "status");
      if (!isStatus(status)) throw new Error(`invalid status '${status}'`);
      return rt.setStatus(reqStr(args, "id"), status, optStr(args, "reason") ?? "");
    },
  },
  {
    name: "flow_advance",
    description: "Advance to the next wave. Barrier: fails unless the current wave is fully resolved.",
    inputSchema: { type: "object", properties: { ...runId }, required: ["runId"], additionalProperties: false },
    handler: (ctx, args) => open(ctx, args).advance(),
  },
  {
    name: "flow_gate",
    description: "Record a human gate decision. A = plan approval, B = final review.",
    inputSchema: {
      type: "object",
      properties: { ...runId, gate: { type: "string", enum: ["A", "B"] }, status: { type: "string" } },
      required: ["runId", "gate", "status"],
      additionalProperties: false,
    },
    handler: (ctx, args) => {
      const rt = open(ctx, args);
      const gate = reqStr(args, "gate");
      if (gate !== "A" && gate !== "B") throw new Error("gate must be 'A' or 'B'");
      rt.recordGate(gate as GateId, reqStr(args, "status"));
      return { ok: true, gate };
    },
  },
  {
    name: "flow_budget",
    description: "Append a token-cost entry to the run's ledger.",
    inputSchema: {
      type: "object",
      properties: {
        ...runId,
        id: { type: "string" },
        tokens: { type: "number" },
        tier: { type: "string" },
        phase: { type: "string" },
      },
      required: ["runId", "id", "tokens", "tier", "phase"],
      additionalProperties: false,
    },
    handler: (ctx, args) => {
      const rt = open(ctx, args);
      rt.chargeBudget(reqStr(args, "id"), reqNum(args, "tokens"), reqStr(args, "tier") as Tier, reqStr(args, "phase"));
      return { ok: true };
    },
  },
  {
    name: "flow_status",
    description: "Return the full projected state of a run: plans, waves, gates, budget.",
    inputSchema: { type: "object", properties: { ...runId }, required: ["runId"], additionalProperties: false },
    handler: (ctx, args) => open(ctx, args).state,
  },
  {
    name: "flow_report",
    description: "Return the token/cost ledger for a run.",
    inputSchema: { type: "object", properties: { ...runId }, required: ["runId"], additionalProperties: false },
    handler: (ctx, args) => {
      const s = open(ctx, args).state;
      return { run: s.run, budget: s.budget };
    },
  },
  {
    name: "flow_execute",
    description:
      "Run one task through the executor: the model writes the files, they are applied under targetDir only, " +
      "the configured verify command runs, and the task is set green (verify ok) or blocked. " +
      "Requires a real LLM backend via FLOW_LLM_* env.",
    inputSchema: {
      type: "object",
      properties: {
        ...runId,
        taskId: { type: "string" },
        instruction: { type: "string" },
        targetDir: { type: "string" },
        verifyCommand: { type: "array", items: { type: "string" } },
        tier: { type: "string" },
      },
      required: ["runId", "taskId", "instruction", "targetDir"],
      additionalProperties: false,
    },
    handler: async (ctx, args) => {
      const rt = open(ctx, args);
      const taskId = reqStr(args, "taskId");
      const instruction = reqStr(args, "instruction");
      const targetDir = reqStr(args, "targetDir");
      const verifyCommand = optStrArray(args, "verifyCommand");
      const tier = optStr(args, "tier");
      const router = ctx.router ?? routerFromEnv();
      const executor = new Executor(router, { verifyCommand, tier });
      rt.setStatus(taskId, "running");
      const result = await executor.run({ id: taskId, instruction }, { targetDir });
      const ok = result.verify.ok;
      rt.setStatus(taskId, ok ? "green" : "blocked", ok ? "" : "verify failed");
      return { taskId, status: ok ? "green" : "blocked", files: result.files, verify: result.verify, reason: result.reason };
    },
  },
  {
    name: "flow_spec",
    description:
      "Run the Spec-Driven Development planner: turn an objective into a spec (requirements, " +
      "acceptance, clarifications) and an ordered task DAG. Requires a real LLM backend via FLOW_LLM_* env.",
    inputSchema: {
      type: "object",
      properties: {
        objective: { type: "string", description: "What to build" },
        context: { type: "string", description: "Optional repo/background context" },
        tier: { type: "string", description: "Model tier for planning (default opus)" },
      },
      required: ["objective"],
      additionalProperties: false,
    },
    handler: async (ctx, args) => {
      const objective = reqStr(args, "objective");
      const context = optStr(args, "context");
      const tier = optStr(args, "tier");
      const router = ctx.router ?? routerFromEnv();
      const planner = new Planner(router, tier ? { tier } : undefined);
      return await planner.plan(objective, context);
    },
  },
  {
    name: "flow_converge",
    description:
      "Deterministic done-vs-spec convergence report: given a plan and a map of task outcomes, " +
      "report which tasks are green, which pending, and whether the plan is complete. Offline (no LLM).",
    inputSchema: {
      type: "object",
      properties: {
        plan: { type: "object", description: "A Plan { spec, approach, tasks }" },
        outcomes: { type: "object", description: "Map of taskId -> outcome string ('green' counts as done)" },
      },
      required: ["plan", "outcomes"],
      additionalProperties: false,
    },
    handler: (_ctx, args) => {
      const plan = args.plan;
      const outcomes = args.outcomes;
      if (typeof plan !== "object" || plan === null) throw new Error("'plan' (object) is required");
      if (typeof outcomes !== "object" || outcomes === null) throw new Error("'outcomes' (object) is required");
      return converge(plan as Plan, outcomes as Record<string, string>);
    },
  },
  {
    name: "flow_qa",
    description:
      "Run the deterministic QA engine: verify each acceptance criterion with its own explicit " +
      "command, capture evidence artifacts, and return a report with per-criterion pass/fail and error " +
      "tickets. Offline (no LLM). Emits evidence/verdicts/tickets, not decisions.",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string", description: "Directory (or URL, later layers) under test" },
        platform: { type: "string", description: "e.g. node | web (default node)" },
        criteria: { type: "array", description: "Acceptance criteria: {id, description, verify[], severity?, tags?}" },
        evidenceDir: { type: "string", description: "Optional dir for evidence artifacts" },
      },
      required: ["target", "criteria"],
      additionalProperties: false,
    },
    handler: (_ctx, args) => {
      const target = reqStr(args, "target");
      const platform = optStr(args, "platform") ?? "node";
      const criteria = args.criteria;
      if (!Array.isArray(criteria)) throw new Error("'criteria' (array) is required");
      const evidenceDir = optStr(args, "evidenceDir");
      return runQA({ target, platform, criteria: criteria as Criterion[] }, evidenceDir ? { evidenceDir } : undefined);
    },
  },
];

export function getTool(name: string): ToolDef {
  const t = tools.find((x) => x.name === name);
  if (!t) throw new Error(`unknown tool: ${name}`);
  return t;
}
