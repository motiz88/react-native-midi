import { MIDIConnectionEvent } from "./MIDIConnectionEvent";
import { MIDIMessageEvent } from "./MIDIMessageEvent";
import { MIDIPort } from "./MIDIPort";

export interface MIDIInput extends MIDIPort {
  readonly type: "input";

  onmidimessage: null | ((e: MIDIMessageEvent) => void);

  addEventListener(
    type: "midimessage",
    listener: (this: this, e: MIDIMessageEvent) => any,
    options?: boolean | AddEventListenerOptions
  ): void;

  // inherited overloads of addEventListener
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
