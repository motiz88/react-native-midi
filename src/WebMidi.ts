import ReactNativeMidiModule from "./ReactNativeMidiModule";

import {
  NativeModulesProxy,
  EventEmitter,
  Subscription,
} from "expo-modules-core";

const emitter = new EventEmitter(
  ReactNativeMidiModule ?? NativeModulesProxy.ReactNativeMidi
);

interface MIDIPort {
  readonly id: string;
  readonly manufacturer: string;
  readonly name: string;
  readonly type: "input" | "output";
  readonly version: string;

  open(): Promise<void>;
  close(): Promise<void>;

  // TODO: update state

  readonly state: "connected" | "disconnected";
  readonly connection: "open" | "closed" | "pending";

  // TODO: statechange event
}

interface MIDIInput extends MIDIPort {
  readonly type: "input";
  // TODO
}

interface MIDIOutput extends MIDIPort {
  readonly type: "output";
  send(data: number[] | Uint8Array, timestamp?: number): void;
  clear(): void;
}

type MIDIInputMap = ReadonlyMap<string, MIDIInput>;
type MIDIOutputMap = ReadonlyMap<string, MIDIOutput>;

interface MIDIConnectionEvent {
  // TODO
}

interface MIDIAccess extends EventTarget {
  readonly inputs: MIDIInputMap;
  readonly outputs: MIDIOutputMap;

  /**
   * The handler called when a new port is connected or an existing port changes the
   * state attribute.
   */
  // TODO
  // onstatechange(e: MIDIConnectionEvent): void;

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

const TYPE_INPUT = 1;
const TYPE_OUTPUT = 2;

class MIDIOutputImpl implements MIDIOutput {
  #deviceInfo;

  #portInfo;

  #openPromise;

  constructor(deviceInfo, portInfo) {
    this.#deviceInfo = deviceInfo;
    this.#portInfo = portInfo;
  }

  clear(): void {
    ReactNativeMidiModule.flush(
      this.#deviceInfo.id,
      this.#portInfo.portNumber
    );
  }

  type: "output" = "output";

  send(data: number[] | Uint8Array, timestamp?: number | undefined): void {
    this.open().then(() => {
        // TODO: timestamp
      ReactNativeMidiModule.send(
        this.#deviceInfo.id,
        this.#portInfo.portNumber,
        Uint8Array.from(data)
      );
    }).catch(e => {
      console.error(e);
    });
  }

  get id() {
    return String(this.#deviceInfo.id + "-" + this.#portInfo.portNumber);
  }

  get manufacturer(): string {
    return this.#deviceInfo.properties.manufacturer;
  }

  get name(): string {
    return [
      this.#deviceInfo.properties.name,
      this.#deviceInfo.properties.product,
    ]
      .filter(Boolean)
      .join(" ");
  }

  get version(): string {
    return this.#deviceInfo.properties.version;
  }

  async open(): Promise<void> {
    if (this.connection === "closed") {
      this.connection = "pending";
      this.#openPromise = ReactNativeMidiModule.openDevice(this.#deviceInfo.id)
        .then(() => {
          ReactNativeMidiModule.openInputPort(
            this.#deviceInfo.id,
            this.#portInfo.portNumber
          );
          this.connection = "open";
          this.#openPromise = null;
        })
        .catch((error) => {
          this.connection = "closed";
          this.#openPromise = null;
          throw error;
        });
      await this.#openPromise;
    } else if (this.connection === "pending") {
      await this.#openPromise!;
    }
  }

  async close(): Promise<void> {
    if (this.#openPromise) {
      try {
        await this.#openPromise;
      } catch {
      } finally {
        this.#openPromise = null;
      }
    }
    ReactNativeMidiModule.closeInputPort(
      this.#deviceInfo.id,
      this.#portInfo.portNumber
    );

    // TODO: Refcount and close the device too

    this.connection = "closed";
  }

  // TODO
  state: "connected" | "disconnected" = "connected";
  connection: "open" | "closed" | "pending" = "closed";
}

class MIDIAccessImpl implements MIDIAccess {
  // onstatechange: ?(e: MIDIConnectionEvent) => void;

  #subscriptions = new Map();

  addEventListener(
    type: "statechange",
    listener: (this: this, e: MIDIConnectionEvent) => any,
    options?: boolean | AddEventListenerOptions | undefined
  ): void {
    if (type !== "statechange") {
      return;
    }
    const subscription = emitter.addListener(
      "onMidiDevicesChanged",
      () => {
        // TODO: proper event object
        listener.call(this, {});
      }
    );
    // TODO: capturing vs non-capturing subscriptions?
    this.#subscriptions.set(listener, subscription);
  }

  dispatchEvent(event: Event): boolean {
    // TODO?
    throw new Error("Method not implemented.");
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions | undefined
  ): void {
    if (type !== "statechange") {
      return;
    }
    this.#subscriptions.get(listener)?.remove();
  }

  constructor() {
    this.addEventListener('statechange', () => {
      this.#outputs = null;
      // this.inputs = null;
    });
  }

  #inputs;

  #outputs;

  get inputs(): MIDIInputMap {
    if (!this.#inputs) {
      this.#inputs = new Map(
        // TODO
      );
    }
    return this.#inputs;
  }

  get outputs(): MIDIOutputMap {
    if (!this.#outputs) {
      this.#outputs = new Map(
        ReactNativeMidiModule.getDevices().flatMap((device) =>
          device.ports
            .filter((port) => port.type === TYPE_INPUT)
            .map((port) => {
              const output = new MIDIOutputImpl(device, port);
              return [output.id, output];
            })
        )
      );
    }
    return this.#outputs;
  }
}

export async function requestMIDIAccess(options) {
  const hasMIDI = await ReactNativeMidiModule.requestMIDIAccess();
  if (hasMIDI) {
    return new MIDIAccessImpl();
  }
  throw new Error("No MIDI access available");
}

export type { MIDIAccess, MIDIOutput, MIDIInput, MIDIPort };
