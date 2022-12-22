import { MIDIAccess } from "./MIDIAccess";
import { MIDIConnectionEvent } from "./MIDIConnectionEvent";
import { MIDIInput } from "./MIDIInput";
import { MIDIInputImpl } from "./MIDIInputImpl";
import { MIDIOutput } from "./MIDIOutput";
import { MIDIOutputImpl } from "./MIDIOutputImpl";
import { MIDIPortImpl } from "./MIDIPortImpl";
import { NativeDeviceInfo, NativePortType } from "./ReactNativeMidi";
import * as ReactNativeMidi from "./ReactNativeMidi";
import { SimpleEventTargetImpl } from "./SimpleEventTargetImpl";

export class MIDIAccessImpl
  extends SimpleEventTargetImpl
  implements MIDIAccess
{
  get onstatechange() {
    return this.getEventAttributeValue("statechange");
  }

  set onstatechange(value) {
    this.setEventAttributeValue("statechange", value);
  }

  readonly #devices: Map<number, Readonly<NativeDeviceInfo>> = new Map();

  private addDevice(
    deviceInfo: Readonly<NativeDeviceInfo>,
    fireEvents: boolean
  ) {
    this.#devices.set(deviceInfo.id, deviceInfo);
    for (const portInfo of deviceInfo.ports) {
      const portId = MIDIPortImpl.getID(deviceInfo, portInfo);
      let port: MIDIPortImpl;
      // NOTE: Android port "types" are from the peripheral's perspective, i.e. inverted
      // We follow the same convention on iOS
      if (portInfo.type === NativePortType.Input) {
        const output = new MIDIOutputImpl(
          deviceInfo,
          portInfo,
          this.sysexEnabled
        );
        port = output;
        this.#outputs.set(portId, output);
      } else {
        const input = new MIDIInputImpl(
          deviceInfo,
          portInfo,
          this.sysexEnabled
        );
        port = input;
        this.#inputs.set(portId, input);
      }
      if (fireEvents) {
        this.dispatchEvent(new MIDIConnectionEvent("statechange", { port }));
      }
    }
  }

  private removeDevice(deviceInfo: Readonly<NativeDeviceInfo>) {
    this.#devices.delete(deviceInfo.id);
    for (const portInfo of deviceInfo.ports) {
      const portId = MIDIPortImpl.getID(deviceInfo, portInfo);
      let port: MIDIPortImpl | void;
      // NOTE: Android port "types" are from the peripheral's perspective, i.e. inverted
      // We follow the same convention on iOS
      if (portInfo.type === NativePortType.Input) {
        const output = this.#outputs.get(portId);
        if (output) {
          port = output;
          output.handleDisconnected();
        }
        this.#outputs.delete(portId);
      } else {
        const input = this.#inputs.get(portId);
        if (input) {
          port = input;
          input.handleDisconnected();
        }
        this.#inputs.delete(portId);
      }
      if (port) {
        this.dispatchEvent(new MIDIConnectionEvent("statechange", { port }));
      }
    }
  }

  constructor(public readonly sysexEnabled: boolean) {
    super();
    for (const device of ReactNativeMidi.getDevices()) {
      this.addDevice(device, false);
    }

    ReactNativeMidi.emitter.addListener(
      "onMidiDeviceAdded",
      (device: NativeDeviceInfo) => {
        // TODO: If possible, reuse port instances across reconnections
        this.addDevice(device, /* fireEvents */ true);
      }
    );

    ReactNativeMidi.emitter.addListener(
      "onMidiDeviceRemoved",
      ({ id }: { id: number }) => {
        const deviceInfo = this.#devices.get(id);
        if (deviceInfo) {
          this.removeDevice(deviceInfo);
        }
      }
    );

    // TODO: Do we need to listen for device state changes?
  }

  readonly #inputs: Map<string, MIDIInputImpl> = new Map();
  readonly #outputs: Map<string, MIDIOutputImpl> = new Map();

  readonly inputs: ReadonlyMap<string, MIDIInput> = this.#inputs;
  readonly outputs: ReadonlyMap<string, MIDIOutput> = this.#outputs;
}
