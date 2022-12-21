import * as React from "react";
import { StyleSheet, Text, View } from "react-native";

import { IoSetupArea } from "./IoSetupArea";
import { MidiIoContext } from "./MidiIoContext";
import { MidiIoSetupContext } from "./MidiIoSetupContext";
import { MidiPlaygroundArea } from "./MidiPlaygroundArea";
import { useMidiIoSetup } from "./useMidiIoSetup";

function MidiIoSetupContainer({ children }: { children?: React.ReactNode }) {
  const midiIoSetupState = useMidiIoSetup();
  return (
    <MidiIoSetupContext.Provider value={midiIoSetupState}>
      <MidiIoContext.Provider value={midiIoSetupState.midiIoContext}>
        {children}
      </MidiIoContext.Provider>
    </MidiIoSetupContext.Provider>
  );
}

export default function App() {
  return (
    <MidiIoSetupContainer>
      <View style={styles.container}>
        <Text style={styles.title}>React Native MIDI example</Text>
        <IoSetupArea />
        <MidiPlaygroundArea />
      </View>
    </MidiIoSetupContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    marginBottom: 8,
  },
});
