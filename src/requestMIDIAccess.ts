import { MIDIAccess } from "./MIDIAccess";
import { MIDIAccessImpl } from "./MIDIAccessImpl";
import { MIDIOptions } from "./MIDIOptions";
import * as ReactNativeMidi from "./ReactNativeMidi";

export async function requestMIDIAccess(
  options?: MIDIOptions
): Promise<MIDIAccess> {
  const hasMIDI = await ReactNativeMidi.requestMIDIAccess();
  if (hasMIDI) {
    return new MIDIAccessImpl(options?.sysex ?? false);
  }
  throw new Error("No MIDI access available");
}
