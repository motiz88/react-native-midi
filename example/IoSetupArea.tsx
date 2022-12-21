import { Picker } from "@react-native-picker/picker";
import { useContext } from "react";
import { Text, View } from "react-native";

import { MidiIoSetupContext } from "./MidiIoSetupContext";

export function IoSetupArea() {
  const {
    inputs,
    outputs,
    setCurrentInputId,
    currentInputId,
    setCurrentOutputId,
    currentOutputId,
  } = useContext(MidiIoSetupContext);

  return (
    <View>
      {inputs && outputs && (
        <>
          <Text>Input</Text>
          <Picker
            onValueChange={setCurrentInputId}
            selectedValue={currentInputId}
          >
            {[...inputs.entries()].map(([key, input]) => (
              <Picker.Item label={input.name} key={key} value={key} />
            ))}
          </Picker>
          <Text>Output</Text>
          <Picker
            onValueChange={setCurrentOutputId}
            selectedValue={currentOutputId}
          >
            {[...outputs.entries()].map(([key, output]) => (
              <Picker.Item label={output.name} key={key} value={key} />
            ))}
          </Picker>
        </>
      )}
    </View>
  );
}
