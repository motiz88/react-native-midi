import EventTargetImpl from "event-target-shim";

import { MIDIConnectionEvent } from "./MIDIConnectionEvent";
export interface MIDIPort extends EventTarget {
  readonly id: string;
  readonly manufacturer: string;
  readonly name: string;
  readonly type: "input" | "output";
  readonly version: string;

  open(): Promise<void>;
  close(): Promise<void>;

  readonly state: "connected" | "disconnected";
  readonly connection: "open" | "closed" | "pending";

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
    listener: EventTargetImpl.FallbackEventListener<any, any>,
    options?: boolean | AddEventListenerOptions
  ): void;
}
