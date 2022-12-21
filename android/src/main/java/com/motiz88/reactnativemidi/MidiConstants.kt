package com.motiz88.reactnativemidi

/**
 * MIDI related constants and static methods.
 */
object MidiConstants {
    /** Number of bytes in a message nc from 8c to Ec  */
    private val CHANNEL_BYTE_LENGTHS = intArrayOf(3, 3, 3, 3, 2, 2, 3)

    /** Number of bytes in a message Fn from F0 to FF  */
    private val SYSTEM_BYTE_LENGTHS = intArrayOf(
        1, 2, 3, 2, 1, 1, 1, 1, 1,
        1, 1, 1, 1, 1, 1, 1
    )

    /**
     * MIDI messages, except for SysEx, are 1,2 or 3 bytes long.
     * You can tell how long a MIDI message is from the first status byte.
     * Do not call this for SysEx, which has variable length.
     * @param statusByte
     * @return number of bytes in a complete message or zero if data byte passed
     */
    fun getBytesPerMessage(statusByte: Byte): Int {
        // Java bytes are signed so we need to mask off the high bits
        // to get a value between 0 and 255.
        val statusInt: Int = statusByte.toInt() and 0xFF
        return if (statusInt >= 0xF0) {
            // System messages use low nibble for size.
            SYSTEM_BYTE_LENGTHS[statusInt and 0x0F]
        } else if (statusInt >= 0x80) {
            // Channel voice messages use high nibble for size.
            CHANNEL_BYTE_LENGTHS[(statusInt shr 4) - 8]
        } else {
            0 // data byte
        }
    }

}