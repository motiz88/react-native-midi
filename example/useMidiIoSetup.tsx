import {
  requestMIDIAccess,
  MIDIMessageEvent,
} from "@motiz88/react-native-midi";
import * as React from "react";
import { useCallback, useEffect, useState } from "react";
import usePromise from "react-use-promise";

function useMIDIAccess(sysex: boolean = false) {
  return usePromise(() => requestMIDIAccess({ sysex }), [sysex]);
}

export function useMidiIoSetup() {
  const [midiAccess] = useMIDIAccess(true);

  const [inputPort, setInputPort] = useState<string>();
  const [outputPort, setOutputPort] = useState<string>();
  const [midiStateChangeCount, setMidiStateChangeCount] = useState(0);

  const handleMidiStateChange = useCallback(() => {
    if (inputPort == null && midiAccess && midiAccess.inputs.size) {
      setInputPort([...midiAccess.inputs.keys()][0]);
    }
    if (outputPort == null && midiAccess && midiAccess.outputs.size) {
      setOutputPort([...midiAccess.outputs.keys()][0]);
    }
    setMidiStateChangeCount((x) => x + 1);
  }, [inputPort, outputPort, midiAccess]);

  useEffect(() => {
    const myMidiAccess = midiAccess;
    if (myMidiAccess) {
      myMidiAccess.addEventListener("statechange", handleMidiStateChange);
      return () => {
        myMidiAccess.removeEventListener("statechange", handleMidiStateChange);
      };
    }
  }, [midiAccess, handleMidiStateChange]);

  useEffect(() => {
    handleMidiStateChange();
  }, [inputPort, outputPort, midiAccess, handleMidiStateChange]);

  useEffect(() => {
    if (inputPort) {
      const input = midiAccess?.inputs.get(inputPort);
      if (input) {
        input.open();
        const listener = (event: MIDIMessageEvent) => {
          if (event.data[0] === 254) {
            // ignore active sensing
            return;
          }
          console.log(
            "receive",
            Array.from(event.data)
              .slice(0, 16)
              .map((b) => b.toString(16).toUpperCase().padStart(2, "0"))
              .join(" "),
            event.data.length > 16 ? "..." : ""
            // event.data.byteLength,
            // "bytes"
          );
        };
        input.addEventListener("midimessage", listener);
        return () => {
          input.removeEventListener("midimessage", listener as any);
          input.close();
        };
      }
    }
  }, [inputPort, midiAccess]);

  const midiIoContext = React.useMemo(
    () => ({
      inputPort: inputPort != null ? midiAccess?.inputs?.get(inputPort) : null,
      outputPort:
        outputPort != null ? midiAccess?.outputs?.get(outputPort) : null,
    }),
    [midiAccess, midiStateChangeCount]
  );

  const { inputs, outputs } = React.useMemo(
    () => ({
      inputs: new Map(midiAccess?.inputs),
      outputs: new Map(midiAccess?.outputs),
    }),
    [midiAccess, midiStateChangeCount]
  );

  return {
    midiIoContext,
    inputs,
    outputs,
    currentInputId: inputPort,
    currentOutputId: outputPort,
    setCurrentInputId: setInputPort,
    setCurrentOutputId: setOutputPort,
  };
}
