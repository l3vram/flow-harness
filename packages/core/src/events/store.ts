import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Event } from "./types.js";

/**
 * Append-only event log persisted as JSON Lines. This is the durable source of truth:
 * the projected state can always be rebuilt by reading and folding these events.
 */
export class EventStore {
  constructor(private readonly path: string) {}

  /** Does the log exist yet? Used to decide whether a run has been initialised. */
  exists(): boolean {
    return existsSync(this.path);
  }

  /** Read the full event history in order. Blank lines are tolerated. */
  read(): Event[] {
    if (!existsSync(this.path)) return [];
    const raw = readFileSync(this.path, "utf8");
    const out: Event[] = [];
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      out.push(JSON.parse(trimmed) as Event);
    }
    return out;
  }

  /** Append one event atomically as a single line. */
  append(event: Event): void {
    mkdirSync(dirname(this.path), { recursive: true });
    appendFileSync(this.path, JSON.stringify(event) + "\n", "utf8");
  }
}
