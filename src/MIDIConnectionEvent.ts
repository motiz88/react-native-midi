import { Event as EventImpl } from "event-target-shim";

import { MIDIPort } from "./MIDIPort";

export class MIDIConnectionEvent extends EventImpl implements Event {
  /**
   * The port that has been connected or disconnected.
   */
  port: MIDIPort | null;

  constructor(type: string, init?: MIDIConnectionEventInit) {
    super(type, init);
    this.port = init?.port ?? null;
  }
}
interface MIDIConnectionEventInit extends EventInit {
  /**
   * The port that has been connected or disconnected.
   */
  port: MIDIPort;
}
