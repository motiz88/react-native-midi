import { validateMidiMessage } from "../validateMidiMessage";

const u8 = (...data: number[]) => Uint8Array.of(...data);

test("Valid MIDI messages", () => {
  // Note on and off
  validateMidiMessage(
    u8(0xff, 0x90, 0x00, 0x00, 0x90, 0x07, 0x00),
    /* sysExEnabled: */ true
  );
});

test("Running status is not allowed", () => {
  expect(() =>
    validateMidiMessage(u8(0x00, 0x01), /* sysExEnabled: */ true)
  ).toThrowErrorMatchingInlineSnapshot(
    `"Running status is not allowed at index 0 (0)."`
  );
});

test("Unexpected end of SysEx", () => {
  expect(() =>
    validateMidiMessage(u8(0xf7), /* sysExEnabled: */ true)
  ).toThrowErrorMatchingInlineSnapshot(
    `"Unexpected end of system exclusive message at index 0 (247)."`
  );
});

test("Unexpected reserved status bytes", () => {
  expect(() =>
    validateMidiMessage(u8(0xf4), /* sysExEnabled: */ true)
  ).toThrowErrorMatchingInlineSnapshot(
    `"Reserved status is not allowed at index 0 (244)."`
  );

  expect(() =>
    validateMidiMessage(u8(0xf5), /* sysExEnabled: */ true)
  ).toThrowErrorMatchingInlineSnapshot(
    `"Reserved status is not allowed at index 0 (245)."`
  );

  expect(() =>
    validateMidiMessage(u8(0xf9), /* sysExEnabled: */ true)
  ).toThrowErrorMatchingInlineSnapshot(
    `"Reserved status is not allowed at index 0 (249)."`
  );

  expect(() =>
    validateMidiMessage(u8(0xfd), /* sysExEnabled: */ true)
  ).toThrowErrorMatchingInlineSnapshot(
    `"Reserved status is not allowed at index 0 (253)."`
  );
});

it("Incomplete channel messages", () => {
  expect(() =>
    validateMidiMessage(u8(0x80), /* sysExEnabled: */ true)
  ).toThrowErrorMatchingInlineSnapshot(`"Message is incomplete."`);

  expect(() =>
    validateMidiMessage(u8(0x80, 0x00), /* sysExEnabled: */ true)
  ).toThrowErrorMatchingInlineSnapshot(`"Message is incomplete."`);

  expect(() =>
    validateMidiMessage(u8(0x90), /* sysExEnabled: */ true)
  ).toThrowErrorMatchingInlineSnapshot(`"Message is incomplete."`);

  expect(() =>
    validateMidiMessage(u8(0x90, 0x00), /* sysExEnabled: */ true)
  ).toThrowErrorMatchingInlineSnapshot(`"Message is incomplete."`);

  expect(() =>
    validateMidiMessage(u8(0xa0), /* sysExEnabled: */ true)
  ).toThrowErrorMatchingInlineSnapshot(`"Message is incomplete."`);

  expect(() =>
    validateMidiMessage(u8(0xa0, 0x00), /* sysExEnabled: */ true)
  ).toThrowErrorMatchingInlineSnapshot(`"Message is incomplete."`);

  expect(() =>
    validateMidiMessage(u8(0xb0), /* sysExEnabled: */ true)
  ).toThrowErrorMatchingInlineSnapshot(`"Message is incomplete."`);

  expect(() =>
    validateMidiMessage(u8(0xb0, 0x00), /* sysExEnabled: */ true)
  ).toThrowErrorMatchingInlineSnapshot(`"Message is incomplete."`);

  expect(() =>
    validateMidiMessage(u8(0xc0), /* sysExEnabled: */ true)
  ).toThrowErrorMatchingInlineSnapshot(`"Message is incomplete."`);

  expect(() =>
    validateMidiMessage(u8(0xd0), /* sysExEnabled: */ true)
  ).toThrowErrorMatchingInlineSnapshot(`"Message is incomplete."`);

  expect(() =>
    validateMidiMessage(u8(0xe0), /* sysExEnabled: */ true)
  ).toThrowErrorMatchingInlineSnapshot(`"Message is incomplete."`);

  expect(() =>
    validateMidiMessage(u8(0xe0, 0x00), /* sysExEnabled: */ true)
  ).toThrowErrorMatchingInlineSnapshot(`"Message is incomplete."`);
});

test("Incomplete system messages", () => {
  expect(() =>
    validateMidiMessage(u8(0xf1), /* sysExEnabled: */ true)
  ).toThrowErrorMatchingInlineSnapshot(`"Message is incomplete."`);

  expect(() =>
    validateMidiMessage(u8(0xf2), /* sysExEnabled: */ true)
  ).toThrowErrorMatchingInlineSnapshot(`"Message is incomplete."`);

  expect(() =>
    validateMidiMessage(u8(0xf2, 0x00), /* sysExEnabled: */ true)
  ).toThrowErrorMatchingInlineSnapshot(`"Message is incomplete."`);

  expect(() =>
    validateMidiMessage(u8(0xf3), /* sysExEnabled: */ true)
  ).toThrowErrorMatchingInlineSnapshot(`"Message is incomplete."`);
});

test("Invalid data bytes", () => {
  expect(() =>
    validateMidiMessage(u8(0x80, 0x80, 0x00), /* sysExEnabled: */ true)
  ).toThrowErrorMatchingInlineSnapshot(
    `"Unexpected status byte at index at index 1 (128)."`
  );

  expect(() =>
    validateMidiMessage(u8(0x80, 0x00, 0x80), /* sysExEnabled: */ true)
  ).toThrowErrorMatchingInlineSnapshot(
    `"Unexpected status byte at index at index 2 (128)."`
  );
});

test("Complete messages", () => {
  validateMidiMessage(u8(0x80, 0x00, 0x00), /* sysexEnabled: */ true);
  validateMidiMessage(u8(0x90, 0x00, 0x00), /* sysexEnabled: */ true);
  validateMidiMessage(u8(0xa0, 0x00, 0x00), /* sysexEnabled: */ true);
  validateMidiMessage(u8(0xb0, 0x00, 0x00), /* sysexEnabled: */ true);
  validateMidiMessage(u8(0xc0, 0x00), /* sysexEnabled: */ true);
  validateMidiMessage(u8(0xd0, 0x00), /* sysexEnabled: */ true);
  validateMidiMessage(u8(0xe0, 0x00, 0x00), /* sysexEnabled: */ true);
});

test("Real-time messages", () => {
  validateMidiMessage(u8(0xf8), /* sysexEnabled: */ true);
  validateMidiMessage(u8(0xfa), /* sysexEnabled: */ true);
  validateMidiMessage(u8(0xfb), /* sysexEnabled: */ true);
  validateMidiMessage(u8(0xfc), /* sysexEnabled: */ true);
  validateMidiMessage(u8(0xfe), /* sysexEnabled: */ true);
  validateMidiMessage(u8(0xff), /* sysexEnabled: */ true);
});

test("Valid messages with Real-Time messages", () => {
  validateMidiMessage(
    u8(
      0x90,
      0xff,
      0xff,
      0x00,
      0xff,
      0x01,
      0xff,
      0x80,
      0xff,
      0x00,
      0xff,
      0xff,
      0x00,
      0xff,
      0xff
    ),
    /* sysexEnabled: */ true
  );
});

test("Valid SysEx messages", () => {
  validateMidiMessage(
    u8(0xf0, 0x00, 0x01, 0x02, 0x03, 0xf7),
    /* sysExEnabled: */ true
  );
  validateMidiMessage(u8(0xf0, 0xf8, 0xf7, 0xff), /* sysExEnabled: */ true);
});

test("Valid SysEx messages when not allowed", () => {
  expect(() =>
    validateMidiMessage(
      u8(0xf0, 0x00, 0x01, 0x02, 0x03, 0xf7),
      /* sysExEnabled: */ false
    )
  ).toThrowErrorMatchingInlineSnapshot(
    `"System exclusive message is not allowed at index 0 (240)."`
  );
  expect(() =>
    validateMidiMessage(u8(0xf0, 0xf8, 0xf7, 0xff), /* sysExEnabled: */ false)
  ).toThrowErrorMatchingInlineSnapshot(
    `"System exclusive message is not allowed at index 0 (240)."`
  );
});

test("Invalid SysEx messages", () => {
  expect(() =>
    validateMidiMessage(u8(0xf0, 0x80, 0xf7), /* sysExEnabled: */ true)
  ).toThrowErrorMatchingInlineSnapshot(
    `"System exclusive message contains a status byte at index 1 (128)."`
  );

  expect(() =>
    validateMidiMessage(u8(0xf0, 0xf0, 0xf7), /* sysExEnabled: */ true)
  ).toThrowErrorMatchingInlineSnapshot(
    `"System exclusive message contains a status byte at index 1 (240)."`
  );

  expect(() =>
    validateMidiMessage(u8(0xf0, 0xff, 0xf7, 0xf7), /* sysExEnabled: */ true)
  ).toThrowErrorMatchingInlineSnapshot(
    `"Unexpected end of system exclusive message at index 3 (247)."`
  );
});

test("Reserved status bytes", () => {
  expect(() =>
    validateMidiMessage(u8(0xf4, 0x80, 0x00, 0x00), /* sysExEnabled: */ true)
  ).toThrowErrorMatchingInlineSnapshot(
    `"Reserved status is not allowed at index 0 (244)."`
  );

  expect(() =>
    validateMidiMessage(u8(0x80, 0xf4, 0x00, 0x00), /* sysExEnabled: */ true)
  ).toThrowErrorMatchingInlineSnapshot(
    `"Unexpected status byte at index at index 1 (244)."`
  );

  expect(() =>
    validateMidiMessage(u8(0x80, 0x00, 0xf4, 0x00), /* sysExEnabled: */ true)
  ).toThrowErrorMatchingInlineSnapshot(
    `"Unexpected status byte at index at index 2 (244)."`
  );

  expect(() =>
    validateMidiMessage(u8(0x80, 0x00, 0x00, 0xf4), /* sysExEnabled: */ true)
  ).toThrowErrorMatchingInlineSnapshot(
    `"Reserved status is not allowed at index 3 (244)."`
  );

  expect(() =>
    validateMidiMessage(u8(0xf0, 0xff, 0xf4, 0xf7), /* sysExEnabled: */ true)
  ).toThrowErrorMatchingInlineSnapshot(
    `"System exclusive message contains a status byte at index 2 (244)."`
  );
});
