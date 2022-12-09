import { Text, View } from "react-native";

import { requestMIDIAccess } from "@motiz88/react-native-midi";

import * as React from "react";

import { Slider } from "@miblanchard/react-native-slider";
import { Picker } from "@react-native-picker/picker";
import { useCallback, useEffect, useState } from "react";
import usePromise from "react-use-promise";

function useMIDIAccess(sysex: boolean = false) {
  return usePromise(() => requestMIDIAccess({ sysex }), [sysex]);
}

export default function App() {
  const [gain, setGain] = React.useState(0);
  const [midiAccess, midiAccessError, midiAccessState] = useMIDIAccess(true);

  const [inputDevice, setInputDevice] = useState<string>();
  const [outputDevice, setOutputDevice] = useState<string>();
  const [midiStateChangeCount, setMidiStateChangeCount] = useState(0);

  const handleMidiStateChange = useCallback(() => {
    if (inputDevice == null && midiAccess && midiAccess.inputs.size) {
      setInputDevice([...midiAccess.inputs.keys()][0]);
    }
    if (outputDevice == null && midiAccess && midiAccess.outputs.size) {
      setOutputDevice([...midiAccess.outputs.keys()][0]);
    }
    setMidiStateChangeCount((x) => x + 1);
  }, [inputDevice, outputDevice, midiAccess]);

  useEffect(() => {
    if (midiAccess) {
      midiAccess.addEventListener("statechange", handleMidiStateChange);
    }
    return () => {
      if (midiAccess) {
        midiAccess.removeEventListener("statechange", handleMidiStateChange);
      }
    };
  }, [midiAccess, handleMidiStateChange]);
  useEffect(() => {
    handleMidiStateChange();
  }, [inputDevice, outputDevice, midiAccess, handleMidiStateChange]);

  const sendGain = React.useCallback(
    (newGain: number) => {
      if (!outputDevice || !midiAccess) {
        console.log(
          "not sending because no midi or output device",
          midiAccess,
          outputDevice
        );
        return;
      }
      const output = midiAccess.outputs.get(outputDevice);
      if (!output) {
        console.log("not sending because no output");
        return;
      }
      const data = makeGR55ParameterChangeMessage([
        /* temporary patch */
        0x18,
        0x00,
        0x00 + 0x07 /* AMP */,
        0x02 /* GAIN */,
        Math.min(Math.max(0, newGain), 120),
      ]);

      output.send(data);
    },
    [midiAccess, outputDevice]
  );

  const setAndSendGain = React.useCallback(
    (newGain: number) => {
      setGain(newGain);
      sendGain(newGain);
    },
    [sendGain]
  );

  useEffect(() => {
    if (midiAccess) {
      const myMidiAccess = midiAccess;
      const subscription = myMidiAccess.addEventListener(
        "statechange",
        handleMidiStateChange
      );
      return () =>
        myMidiAccess.removeEventListener("statechange", handleMidiStateChange);
    }
  }, [midiAccess]);

  return (
    <View>
      <View>
        <Text>MIDI access: {midiAccessState}</Text>
        <Text>MIDI access error: {midiAccessError?.stack}</Text>
        <Text>MIDI state changes: {midiStateChangeCount}</Text>
      </View>
      {midiAccess && (
        <View>
          <Picker onValueChange={setInputDevice} selectedValue={inputDevice}>
            {[...midiAccess.inputs.entries()].map(([key, input]) => (
              <Picker.Item label={input.name} key={key} value={key} />
            ))}
          </Picker>
          <Picker onValueChange={setOutputDevice} selectedValue={outputDevice}>
            {[...midiAccess.outputs.entries()].map(([key, output]) => (
              <Picker.Item label={output.name} key={key} value={key} />
            ))}
          </Picker>
        </View>
      )}
      <Text>{gain}</Text>
      <Slider
        minimumValue={0}
        maximumValue={120}
        step={1}
        onValueChange={setAndSendGain as any}
        value={gain}
      />
    </View>
  );
}

function rolandChecksum(bytes: ReadonlyArray<number>) {
  let sum = 0;
  for (const x of bytes) {
    sum += x;
    sum %= 128;
  }
  return 128 - sum;
}

function makeGR55ParameterChangeMessage(
  addressAndValue: ReadonlyArray<number>
) {
  return [
    0xf0,
    // manufacturer ID (Roland)
    0x41,
    // Device midi identity ( fixed)
    0x10,
    // Roland GR-55 identification
    0x00,
    0x00,
    0x53,
    // Parameter change
    0x12,
    ...addressAndValue,
    // checksum
    rolandChecksum(addressAndValue),
    // end sysex
    0xf7,
  ];
}
