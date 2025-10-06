import { EventSink } from "../../types.js";

export class RedpandaEvents implements EventSink {
  constructor(private brokers: string) {}

  async publish(_event: { type: string; payload: Record<string, unknown>; ts?: number }): Promise<void> {
    // TODO: implement with kafka client
    throw new Error("RedpandaEvents.publish not implemented");
  }
}

