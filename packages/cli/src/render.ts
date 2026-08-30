import type { State, Status } from "@flow/core";

/** Map a status to the short label the panel shows (ported from flow.sh's jq `icon`). */
function icon(status: Status): string {
  switch (status) {
    case "green":
      return "green";
    case "running":
      return "running";
    case "review":
      return "review";
    case "blocked":
      return "BLOCKED";
    default:
      return "waiting";
  }
}

/** Align rows into columns padded to their widest cell, joined with two spaces. */
function table(rows: string[][]): string {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, i) => {
      widths[i] = Math.max(widths[i] ?? 0, cell.length);
    });
  }
  return rows
    .map((row) =>
      row
        .map((cell, i) => (i === row.length - 1 ? cell : cell.padEnd(widths[i] ?? 0)))
        .join("  ")
        .trimEnd(),
    )
    .join("\n");
}

/** Render the fleet panel. Human-facing; mirrors flow.sh's `panel`. */
export function renderPanel(s: State): string {
  const header =
    `FLEET | phase: ${s.phase} | wave ${s.current_wave + 1}/${s.waves.length} | ` +
    `gates A:${s.gates.A} B:${s.gates.B}`;

  const rows: string[][] = [["PLAN", "ROLE", "TIER", "STATUS", "TRY", "DEPS"]];
  for (const p of s.plans) {
    rows.push([
      p.id,
      p.role,
      p.tier,
      icon(p.status),
      String(p.attempts),
      p.deps.length === 0 ? "-" : p.deps.join(","),
    ]);
  }

  const members = s.waves[s.current_wave] ?? [];
  const footer =
    `wave ${s.current_wave + 1} members: ${members.join(", ")}\n` +
    `objective: ${s.objective || "-"}`;

  return `${header}\n\n${table(rows)}\n\n${footer}`;
}

function entries(record: Record<string, number>): string[] {
  return Object.entries(record).map(([k, v]) => `  ${k}: ${v}`);
}

/** Render the token ledger. Mirrors flow.sh's `report`. */
export function renderReport(s: State): string {
  const lines: string[] = [
    `TOKEN LEDGER — run ${s.run}`,
    "",
    "by phase:",
    ...entries(s.budget.by_phase),
    "by tier:",
    ...entries(s.budget.by_tier),
    "by plan:",
    ...entries(s.budget.by_plan),
    "",
    `spawns: ${s.budget.spawns}`,
  ];
  if (s.budget.notes !== "") lines.push(`notes: ${s.budget.notes}`);
  lines.push("", "(null or missing = harness did not report it. Never substitute an estimate.)");
  return lines.join("\n");
}
