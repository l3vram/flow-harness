#!/usr/bin/env node
import { dirname, join } from "node:path";
import { Runtime, isStatus, type GateId, type Status } from "@flow/core";
import { renderPanel, renderReport } from "./render.js";

// `flow` — a drop-in replacement for flow.sh. Same commands, same output shape, same exit
// codes. The difference is underneath: state is a projection of an append-only event log,
// so a run survives a process restart and can be replayed. No LLM lives here; this is the
// deterministic plumbing the orchestrator calls.

const USAGE = `flow — deterministic plumbing for the flow harness

  flow init <run-id> [objective]              create the run (.flow/)
  flow add <id> <role> <tier> [deps]          register a plan (deps comma-separated)
  flow waves                                  recompute wave layering (Kahn); exit 2 on a cycle
  flow set <id> <status> [reason]             pending|running|review|green|blocked
  flow ready                                  plan ids dispatchable now
  flow wave-done                              exit 0 if current wave fully resolved
  flow advance                                move to the next wave (barrier-guarded)
  flow gate <A|B> <status>                    record a human gate decision
  flow budget <id> <tokens> <tier> <phase>    append to the token ledger
  flow panel                                  render the fleet table
  flow report                                 render the token ledger

State dir: FLOW_STATE (default .flow/state.json). Events live beside it as events.jsonl.`;

function fail(message: string, code = 1): never {
  process.stderr.write(message + "\n");
  process.exit(code);
}

function out(message: string): void {
  process.stdout.write(message + "\n");
}

function main(argv: string[]): void {
  const [command, ...rest] = argv;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    out(USAGE);
    return;
  }

  const statePath = process.env.FLOW_STATE ?? join(".flow", "state.json");
  const dir = dirname(statePath);
  const rt = new Runtime(dir);

  const requireStarted = (): void => {
    if (!rt.started()) fail(`flow: no ${join(dir, "events.jsonl")} — run 'flow init' first`);
  };

  switch (command) {
    case "init": {
      const [run, objective] = rest;
      if (!run) fail("flow init: <run-id> required");
      Runtime.init(dir, run, objective ?? "");
      out(`init ${statePath}`);
      return;
    }

    case "add": {
      requireStarted();
      const [id, role, tier, depsStr] = rest;
      if (!id || !role || !tier) fail("flow add: <id> <role> <tier> required");
      const deps = depsStr ? depsStr.split(",").filter((d) => d.length > 0) : [];
      rt.addTask(id, role, tier, deps);
      out(`add ${id} (${role}/${tier}) deps=[${depsStr ?? ""}]`);
      return;
    }

    case "waves": {
      requireStarted();
      const { waves, cycle } = rt.waves();
      waves.forEach((w, i) => out(`wave ${i + 1}: ${w.join(", ")}`));
      out(`(${waves.length} waves)`);
      if (cycle.length > 0) {
        process.stderr.write(`CYCLE in dependency graph involving: ${cycle.join(", ")}\n`);
        process.stderr.write("Fix plans/README.md before dispatching — these plans cannot be ordered.\n");
        process.exit(2);
      }
      return;
    }

    case "set": {
      requireStarted();
      const [id, status] = rest;
      const reason = rest.slice(2).join(" ");
      if (!id || !status) fail("flow set: <id> <status> required");
      if (!isStatus(status)) fail(`flow set: invalid status '${status}' (pending|running|review|green|blocked)`);
      const res = rt.setStatus(id, status as Status, reason);
      if (res.breaker) {
        out(`set ${id} -> blocked (CIRCUIT BREAKER at ${res.attempts} attempts — escalate to human gate)`);
      } else {
        out(`set ${id} -> ${status}${reason ? ` (${reason})` : ""}`);
      }
      return;
    }

    case "ready": {
      requireStarted();
      for (const id of rt.ready()) out(id);
      return;
    }

    case "wave-done": {
      requireStarted();
      if (rt.waveDone()) {
        out("wave complete");
        return;
      }
      out("wave in progress");
      process.exit(1);
    }

    case "advance": {
      requireStarted();
      try {
        const { wave, total } = rt.advance();
        out(`advanced to wave ${wave + 1}/${total}`);
      } catch {
        fail("barrier: current wave not complete — not advancing");
      }
      return;
    }

    case "gate": {
      requireStarted();
      const [gate, status] = rest;
      if (!gate || !status) fail("flow gate: <A|B> <status> required");
      rt.recordGate(gate as GateId, status);
      out(`gate ${gate} -> ${status}`);
      return;
    }

    case "budget": {
      requireStarted();
      const [id, tokensStr, tier, phase] = rest;
      if (!id || !tokensStr || !tier || !phase) fail("flow budget: <id> <tokens> <tier> <phase> required");
      const tokens = Number(tokensStr);
      if (!Number.isFinite(tokens)) fail(`flow budget: '${tokensStr}' is not a number`);
      rt.chargeBudget(id, tokens, tier, phase);
      out(`budget +${tokens} (${tier}/${phase}) -> ${id}`);
      return;
    }

    case "panel": {
      requireStarted();
      out(renderPanel(rt.state));
      return;
    }

    case "report": {
      requireStarted();
      out(renderReport(rt.state));
      return;
    }

    default:
      fail(`flow: unknown command '${command}'\n\n${USAGE}`);
  }
}

main(process.argv.slice(2));
