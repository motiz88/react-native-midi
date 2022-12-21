import { InvalidStateError } from "./InvalidStateError";
import { MIDIOutput } from "./MIDIOutput";
import { MIDIPortImpl } from "./MIDIPortImpl";
import * as ReactNativeMidi from "./ReactNativeMidi";
import { convertTimestampToNative } from "./timestampConversion";
import { validateMidiMessage } from "./validateMidiMessage";

export class MIDIOutputImpl extends MIDIPortImpl implements MIDIOutput {
  #timesCleared: number = 0;

  clear(): void {
    ReactNativeMidi.flush(this.deviceInfo.id, this.portInfo.portNumber);
    ++this.#timesCleared;
    if (this.#timesCleared === Number.MAX_SAFE_INTEGER) {
      this.#timesCleared = 0;
    }
  }

  readonly type: "output" = "output";

  private sendPreparedData(data: Uint8Array, timestamp?: number): void {
    ReactNativeMidi.send(
      this.deviceInfo.id,
      this.portInfo.portNumber,
      data,
      timestamp != null ? convertTimestampToNative(timestamp) : undefined
    ).catch(() => {
      /* ignore rejection */
    });
  }

  private prepareData(data: number[] | Uint8Array): Uint8Array {
    const preparedData = Uint8Array.from(data);
    validateMidiMessage(preparedData, this.sysExEnabled);
    return preparedData;
  }

  send(data: number[] | Uint8Array, timestamp?: number): void {
    if (this.state === "disconnected") {
      throw new InvalidStateError("Port is disconnected");
    }
    const preparedData = this.prepareData(data);
    if (this.connection === "open") {
      // Already open, fast path
      this.sendPreparedData(preparedData, timestamp);
      return;
    }
    const timesClearedBeforeOpen = this.#timesCleared;
    // Implicit open
    this.open().then(
      () => {
        if (timesClearedBeforeOpen !== this.#timesCleared) {
          // clear() has been called at least once
          return;
        }
        this.sendPreparedData(preparedData, timestamp);
      },
      () => {
        /* ignore rejection */
      }
    );
  }

  protected override async openPort(): Promise<void> {
    // NOTE: Android port "types" are from the peripheral's perspective, i.e. inverted
    return await ReactNativeMidi.openInputPort(
      this.deviceInfo.id,
      this.portInfo.portNumber
    );
  }

  protected override closePort() {
    ReactNativeMidi.closeInputPort(
      this.deviceInfo.id,
      this.portInfo.portNumber
    );
  }
}
