import type { MIDIInput, MIDIOutput } from "@motiz88/react-native-midi";
import * as React from "react";

export const MidiIoContext = React.createContext<{
  inputPort: MIDIInput | void | null;
  outputPort: MIDIOutput | void | null;
}>({ inputPort: null, outputPort: null });
