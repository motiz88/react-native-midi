import { CodedError } from "expo-modules-core";

import { InvalidAccessError } from "./InvalidAccessError";
import { MIDIConnectionEvent } from "./MIDIConnectionEvent";
import { MIDIPort } from "./MIDIPort";
import * as ReactNativeMidi from "./ReactNativeMidi";
import { NativeDeviceInfo, AndroidPortInfo } from "./ReactNativeMidi";
import { SimpleEventTargetImpl } from "./SimpleEventTargetImpl";

export abstract class MIDIPortImpl
  extends SimpleEventTargetImpl
  implements MIDIPort
{
  constructor(
    protected deviceInfo: Readonly<NativeDeviceInfo>,
    protected portInfo: Readonly<AndroidPortInfo>,
    protected readonly sysExEnabled: boolean
  ) {
    super();
  }

  get onstatechange() {
    return this.getEventAttributeValue("statechange");
  }

  set onstatechange(value) {
    this.setEventAttributeValue("statechange", value);
  }

  static getID(
    deviceInfo: Readonly<NativeDeviceInfo>,
    portInfo: Readonly<AndroidPortInfo>
  ) {
    return String(deviceInfo.id + "-" + portInfo.portNumber);
  }

  get id() {
    return MIDIPortImpl.getID(this.deviceInfo, this.portInfo);
  }

  get manufacturer(): string {
    return this.deviceInfo.properties.manufacturer;
  }

  get name(): string {
    return (
      this.deviceInfo.properties.name ??
      ("product" in this.deviceInfo.properties
        ? this.deviceInfo.properties.product
        : null) ??
      ""
    );
  }

  get version(): string {
    return "version" in this.deviceInfo.properties
      ? this.deviceInfo.properties.version
      : "";
  }

  async open(): Promise<void> {
    if (this.#openPromise) {
      return await this.#openPromise;
    }
    if (this.state === "disconnected") {
      this.connection = "pending";
      // TODO: open on reconnection
      return;
    }
    if (this.connection === "closed") {
      this.connection = "pending";
    }
    if (this.connection === "pending") {
      this.#openPromise = ReactNativeMidi.openDevice(this.deviceInfo.id)
        .then(() => this.openPort())
        .then(() => {
          this.connection = "open";
          this.#openPromise = null;
        })
        .catch((error) => {
          this.connection = "closed";
          this.#openPromise = null;
          if (
            error instanceof CodedError &&
            error.code === "INVALID_ACCESS_ERROR"
          ) {
            throw new InvalidAccessError(error.message);
          }
          throw error;
        });
      await this.#openPromise;
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

    // TODO: Refcount and close the device too
    this.connection = "closed";
  }

  handleDisconnected() {
    const prevConnection = this.connection;
    const prevState = this.state;
    if (this.connection === "open") {
      this.connection = "pending";
    }
    this.#openPromise = null;
    this.state = "disconnected";
    if (prevConnection !== this.connection || prevState !== this.state) {
      this.dispatchEvent(
        new MIDIConnectionEvent("statechange", { port: this })
      );
    }
  }

  protected abstract openPort(): Promise<void>;
  protected abstract closePort(): void;

  state: "connected" | "disconnected" = "connected";
  connection: "open" | "closed" | "pending" = "closed";

  #openPromise: Promise<void> | null = null;

  abstract readonly type: "output" | "input";
}
