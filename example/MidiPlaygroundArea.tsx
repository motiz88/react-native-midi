import { MIDIMessageEvent } from "@motiz88/react-native-midi";
import { useCallback, useContext, useEffect, useState } from "react";
import {
  Button,
  FlatList,
  ListRenderItem,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { MidiIoContext } from "./MidiIoContext";

type MIDILogItem = {
  dataHex: string;
  origin: string;
};

export function MidiPlaygroundArea() {
  const [messages, setMessages] = useState<MIDILogItem[]>([]);
  const renderMessage: ListRenderItem<MIDILogItem> = useCallback(({ item }) => {
    return (
      <Text style={styles.logLine}>
        <Text style={styles.origin}>{item.origin}:</Text> {item.dataHex}
      </Text>
    );
  }, []);
  const { inputPort, outputPort } = useContext(MidiIoContext);
  const [echoToOutput, setEchoToOutput] = useState(false);
  const [activeSense, setActiveSense] = useState(false);
  useEffect(() => {
    if (inputPort) {
      const listener = (event: MIDIMessageEvent) => {
        setMessages((m) =>
          m.concat([
            {
              dataHex: [...event.data]
                .map((b) => b.toString(16).toUpperCase().padStart(2, "0"))
                .join(" "),
              origin: inputPort.name,
            },
          ])
        );
        if (echoToOutput && outputPort) {
          outputPort.send(event.data);
        }
      };
      inputPort.addEventListener("midimessage", listener);
      return () => {
        inputPort.removeEventListener("midimessage", listener as any);
      };
    }
  }, [inputPort, outputPort, echoToOutput]);
  useEffect(() => {
    if (activeSense && outputPort) {
      const interval = setInterval(() => {
        outputPort.send([0xfe]);
      }, 300);
      return () => clearInterval(interval);
    }
  }, [activeSense, outputPort]);
  const clear = useCallback(() => {
    setMessages([]);
  }, []);
  return (
    <>
      <View style={styles.controlRow}>
        <Button onPress={clear} title="Clear Log" />
        <View style={styles.switchAndLabel}>
          <Switch value={!!activeSense} onValueChange={setActiveSense} />
          <Text style={outputPort ? null : styles.unavailableSwitchLabel}>
            Active sense
          </Text>
        </View>
        <View style={styles.switchAndLabel}>
          <Switch value={!!echoToOutput} onValueChange={setEchoToOutput} />
          <Text style={outputPort ? null : styles.unavailableSwitchLabel}>
            Echo to output
          </Text>
        </View>
      </View>
      {messages.length ? null : (
        <Text>Received MIDI messages will appear below.</Text>
      )}
      <FlatList data={messages} renderItem={renderMessage} />
    </>
  );
}

const styles = StyleSheet.create({
  controlRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  switchAndLabel: {
    flexDirection: "row",
    alignItems: "center",
  },
  unavailableSwitchLabel: {
    color: "gray",
  },
  logLine: {
    paddingBottom: 4,
  },
  origin: {
    color: "gray",
  },
});
