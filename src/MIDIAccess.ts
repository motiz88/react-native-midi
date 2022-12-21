import { MIDIConnectionEvent } from "./MIDIConnectionEvent";
import { MIDIInputMap } from "./MIDIInputMap";
import { MIDIOutputMap } from "./MIDIOutputMap";

export interface MIDIAccess extends EventTarget {
  readonly inputs: MIDIInputMap;
  readonly outputs: MIDIOutputMap;
  readonly sysexEnabled: boolean;

  /**
   * The handler called when a new port is connected or an existing port changes the
   * state attribute.
   */
  onstatechange: null | ((e: MIDIConnectionEvent) => void);

  addEventListener(
    type: "statechange",
    listener: (this: this, e: MIDIConnectionEvent) => any,
    options?: boolean | AddEventListenerOptions
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void;
}
