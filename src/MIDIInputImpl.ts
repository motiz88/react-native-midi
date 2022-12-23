import { Subscription } from "expo-modules-core";

import { MIDIInput } from "./MIDIInput";
import { MIDIMessageEvent } from "./MIDIMessageEvent";
import { MIDIPortImpl } from "./MIDIPortImpl";
import * as ReactNativeMidi from "./ReactNativeMidi";

export class MIDIInputImpl extends MIDIPortImpl implements MIDIInput {
  get onmidimessage() {
    return this.getEventAttributeValue("midimessage");
  }

  set onmidimessage(value) {
    this.setEventAttributeValue("midimessage", value);
  }

  protected override async openPort(): Promise<void> {
    // NOTE: Android port "types" are from the peripheral's perspective, i.e. inverted
    return await ReactNativeMidi.openOutputPort(
      this.deviceInfo.id,
      this.portInfo.portNumber
    );
  }

  protected closePort(): void {
    ReactNativeMidi.closeOutputPort(
      this.deviceInfo.id,
      this.portInfo.portNumber
    );
  }

  protected override onAddedListener(type: string): void {
    if (type !== "midimessage") {
      return;
    }
    if (this.connection !== "open") {
      this.open().catch(() => {
        /* ignore rejection */
      });
    }
  }

  protected override onAddedFirstListener(type: string): void {
    if (type !== "midimessage") {
      return;
    }
    this.#midiMessageSubscription = ReactNativeMidi.emitter.addListener(
      "onMidiMessageReceived",
      ({
        data,
        id,
        portNumber,
      }: {
        id: number;
        portNumber: number;
        data: number[];
      }) => {
        if (
          id !== this.deviceInfo.id ||
          portNumber !== this.portInfo.portNumber
        ) {
          return;
        }
        // Messages are guaranteed to be complete here - filter out SysEx messages as needed
        if (!this.sysExEnabled && data[0] === 0xf0) {
          return;
        }
        this.dispatchEvent(
          new MIDIMessageEvent("midimessage", {
            data: Uint8Array.from(data),
            // TODO: Send a more accurate time from the native side?
            receivedTime: performance.now(),
          })
        );
      }
    );
  }

  protected override onRemovedLastListener(type: string): void {
    if (type !== "midimessage") {
      return;
    }
    this.#midiMessageSubscription!.remove();
    this.#midiMessageSubscription = null;
  }

  readonly type: "input" = "input";

  #midiMessageSubscription: Subscription | null = null;
}
