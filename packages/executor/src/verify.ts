import { spawnSync } from "node:child_process";
import type { VerifyResult } from "./types.js";

/**
 * Runs the configured verify command inside `targetDir`. The command comes only from the
 * caller-supplied `command` argument — never from model output — so untrusted content can never
 * choose what gets executed. An empty command means "no verification configured."
 */
export function runVerify(targetDir: string, command: string[]): VerifyResult {
  if (command.length === 0) {
    return { ran: false, ok: true, output: "" };
  }
  const [cmd, ...args] = command;
  // Non-empty command array guarantees cmd is defined; noUncheckedIndexedAccess still requires a guard.
  if (cmd === undefined) {
    return { ran: false, ok: true, output: "" };
  }
  const res = spawnSync(cmd, args, { cwd: targetDir, encoding: "utf8" });
  const output = (res.stdout ?? "") + (res.stderr ?? "");
  const ok = res.status === 0;
  return { ran: true, ok, output };
}
