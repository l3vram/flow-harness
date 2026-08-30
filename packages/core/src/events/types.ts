import type { GateId, Status, Tier } from "../domain/types.js";

// The durable event vocabulary. events.jsonl is the source of truth; state.json is a
// projection you can delete and rebuild. Every mutation is expressed as one of these.

export interface BaseEvent {
  /** ISO-8601 timestamp. */
  ts: string;
}

export type Event =
  | (BaseEvent & { type: "run.started"; run: string; objective: string })
  | (BaseEvent & { type: "task.added"; id: string; role: string; tier: Tier; deps: string[] })
  | (BaseEvent & { type: "task.status"; id: string; status: Status; reason?: string })
  | (BaseEvent & { type: "wave.advanced" })
  | (BaseEvent & { type: "gate.recorded"; gate: GateId; status: string })
  | (BaseEvent & {
      type: "budget.charged";
      id: string;
      tokens: number;
      tier: Tier;
      phase: string;
    });

export type EventType = Event["type"];
