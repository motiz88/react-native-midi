import { Event as EventImpl } from "event-target-shim";

export class MIDIMessageEvent extends EventImpl implements Event {
  /**
   * A timestamp specifying when the event occurred.
   */
  receivedTime: number;

  /**
   * A Uint8Array containing the MIDI data bytes of a single MIDI message.
   */
  data: Uint8Array;

  constructor(type: string, init?: MIDIMessageEventInit) {
    super(type, init);
    this.receivedTime = init?.receivedTime ?? 0;
    this.data = init?.data ?? Uint8Array.of();
  }
}

export interface MIDIMessageEventInit extends EventInit {
  /**
   * A timestamp specifying when the event occurred.
   */
  receivedTime: number;

  /**
   * A Uint8Array containing the MIDI data bytes of a single MIDI message.
   */
  data: Uint8Array;
}
