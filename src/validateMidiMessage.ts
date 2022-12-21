import { InvalidAccessError } from "./InvalidAccessError";

const channelMessageLength = [3, 3, 3, 3, 2, 2, 3]; // for 0x8*, 0x9*, ..., 0xe*
const systemMessageLength = [2, 3, 2, 0, 0, 1, 0]; // for 0xf1, 0xf2, ..., 0xf7

// Adapted from Chromium's implementation
export function validateMidiMessage(
  data: Uint8Array,
  sysExEnabled: boolean
): void {
  let offset = 0;
  while (!isEndOfData() && acceptRealTimeMessages()) {
    if (!isStatusByte()) {
      throw new TypeError(
        "Running status is not allowed " + getPositionString()
      );
    }
    if (isEndOfSysEx()) {
      throw new TypeError(
        "Unexpected end of system exclusive message " + getPositionString()
      );
    }
    if (isReservedStatusByte()) {
      throw new TypeError(
        "Reserved status is not allowed " + getPositionString()
      );
    }
    if (isSysEx()) {
      if (!sysExEnabled) {
        throw new InvalidAccessError(
          "System exclusive message is not allowed " + getPositionString()
        );
      }
      if (!acceptCurrentSysex()) {
        if (isEndOfData())
          throw new TypeError(
            "System exclusive message is not ended by end of system exclusive message."
          );
        else
          throw new TypeError(
            "System exclusive message contains a status byte " +
              getPositionString()
          );
      }
    } else {
      if (!acceptCurrentMessage()) {
        if (isEndOfData()) throw new TypeError("Message is incomplete.");
        else
          throw new TypeError(
            "Unexpected status byte at index " + getPositionString()
          );
      }
    }
  }
  function isEndOfData() {
    return offset >= data.length;
  }
  function isSysEx() {
    return data[offset] === 0xf0;
  }
  function isSystemMessage() {
    return data[offset] >= 0xf0;
  }
  function isEndOfSysEx() {
    return data[offset] === 0xf7;
  }
  function isRealTimeMessage() {
    return data[offset] >= 0xf8;
  }
  function isStatusByte() {
    return (data[offset] & 0x80) !== 0;
  }
  function isReservedStatusByte() {
    return (
      data[offset] === 0xf4 ||
      data[offset] === 0xf5 ||
      data[offset] === 0xf9 ||
      data[offset] === 0xfd
    );
  }
  function acceptRealTimeMessages() {
    for (; !isEndOfData(); offset++) {
      if (isRealTimeMessage() && !isReservedStatusByte()) continue;
      return true;
    }
    return false;
  }
  function acceptCurrentSysex() {
    // ASSERT(isSysex());
    for (offset++; !isEndOfData(); offset++) {
      if (isReservedStatusByte()) return false;
      if (isRealTimeMessage()) continue;
      if (isEndOfSysEx()) {
        offset++;
        return true;
      }
      if (isStatusByte()) return false;
    }
    return false;
  }
  function acceptCurrentMessage() {
    // ASSERT(isStatusByte());
    // ASSERT(!isSysEx());
    // ASSERT(!isReservedStatusByte());
    // ASSERT(!isRealTimeMessage());
    const length = isSystemMessage()
      ? systemMessageLength[data[offset] - 0xf1]
      : channelMessageLength[(data[offset] >> 4) - 8];
    let count = 1;
    for (offset++; !isEndOfData(); offset++) {
      if (isReservedStatusByte()) return false;
      if (isRealTimeMessage()) continue;
      if (isStatusByte()) return false;
      if (++count === length) {
        offset++;
        return true;
      }
    }
    return false;
  }
  function getPositionString() {
    return `at index ${offset} (${data[offset]}).`;
  }
}

export function getChannelMessageLength(statusByte: number): number {
  // https://www.midi.org/specifications-old/item/table-1-summary-of-midi-message
  switch (statusByte & 0xf0) {
    case 0x80:
    case 0x90:
    case 0xa0:
    case 0xb0:
    case 0xe0:
      return 2;
    case 0xc0:
    case 0xd0:
      return 1;
    default:
      return 0;
  }
}
