import type { MIDIAccess } from "./WebMidi";

export function requestMIDIAccess(...args): Promise<MIDIAccess> {
  // TODO: Fix WebMidi.MIDIAccess upstream to not expose mutable maps of inputs/outputs
  return navigator.requestMIDIAccess(...args) as any;
}
