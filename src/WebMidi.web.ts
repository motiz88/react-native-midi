import { MIDIAccess } from "./MIDIAccess";

export function requestMIDIAccess(
  options?: WebMidi.MIDIOptions
): Promise<MIDIAccess> {
  // TODO: Fix WebMidi.MIDIAccess upstream to not expose mutable maps of inputs/outputs
  return navigator.requestMIDIAccess(options) as any;
}

// TODO: Reexport other globals that make up the Web MIDI API
