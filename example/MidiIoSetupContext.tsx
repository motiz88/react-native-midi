import type { MIDIInput, MIDIOutput } from "@motiz88/react-native-midi";
import * as React from "react";

export const MidiIoSetupContext = React.createContext<{
  midiIoContext: {
    inputPort: MIDIInput | null | undefined;
    outputPort: MIDIOutput | null | undefined;
  };
  inputs: ReadonlyMap<string, MIDIInput>;
  outputs: ReadonlyMap<string, MIDIOutput>;
  currentInputId: string | undefined;
  currentOutputId: string | undefined;
  setCurrentInputId: (id: string) => void;
  setCurrentOutputId: (id: string) => void;
}>({
  midiIoContext: {
    inputPort: null,
    outputPort: null,
  },
  inputs: new Map(),
  outputs: new Map(),
  currentInputId: undefined,
  currentOutputId: undefined,
  setCurrentInputId: () => {},
  setCurrentOutputId: () => {},
});
