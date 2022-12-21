import { MIDIPort } from "./MIDIPort";

export interface MIDIOutput extends MIDIPort {
  readonly type: "output";
  send(data: number[] | Uint8Array, timestamp?: number): void;
  clear(): void;
}
