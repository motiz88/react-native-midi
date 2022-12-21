package com.motiz88.reactnativemidi

import android.media.midi.MidiReceiver
import android.os.Build
import androidx.annotation.RequiresApi
import java.io.ByteArrayOutputStream
import java.io.IOException

/**
 * Convert stream of bytes to discrete messages.
 *
 * Parses the incoming bytes and then posts individual messages to the receiver
 * specified in the constructor. All messages (including SysEx) will be complete.
 *
 * Resolves Running Status and interleaved System Real-Time messages.
 *
 * Based on MidiFramer.java from the Android Open Source Project.
 */
@RequiresApi(Build.VERSION_CODES.M)
class MidiFramer(private val mReceiver: MidiReceiver) : MidiReceiver() {
    private val mBuffer = ByteArray(3)
    private val mSysExBuffer = ByteArrayOutputStream()
    private var mCount = 0
    private var mRunningStatus: Byte = 0
    private var mNeeded = 0
    private var mInSysEx = false

    /*
     * @see android.midi.MidiReceiver#onSend(byte[], int, int, long)
     */
    @Throws(IOException::class)
    override fun onSend(data: ByteArray, startOffset: Int, count: Int, timestamp: Long) {
        var offset = startOffset
        var sysExStartOffset = if (mInSysEx) offset else -1
        for (i in 0 until count) {
            val currentByte = data[offset]
            val currentInt: Int = currentByte.toInt() and 0xFF
            if (currentInt >= 0x80) { // status byte?
                if (currentInt < 0xF0) { // channel message?
                    mRunningStatus = currentByte
                    mCount = 1
                    mNeeded = MidiConstants.getBytesPerMessage(currentByte) - 1
                } else if (currentInt < 0xF8) { // system common?
                    if (currentInt == 0xF0 /* SysEx Start */) {
                        mInSysEx = true
                        sysExStartOffset = offset
                    } else if (currentInt == 0xF7 /* SysEx End */) {
                        if (mInSysEx) {
                            if (mSysExBuffer.size() > 0) {
                                // Completing a previously incomplete SysEx message - copy into a
                                // contiguous buffer and send all at once
                                mSysExBuffer.write(data, sysExStartOffset, offset - sysExStartOffset + 1)
                                mReceiver.send(
                                    mSysExBuffer.toByteArray(), 0,
                                    mSysExBuffer.size(), timestamp
                                )
                                mSysExBuffer.reset()
                            } else {
                                // SysEx message that starts and ends within `data`
                                mReceiver.send(
                                    data, sysExStartOffset,
                                    offset - sysExStartOffset + 1, timestamp
                                )
                            }
                            mInSysEx = false
                            sysExStartOffset = -1
                        }
                    } else {
                        mBuffer[0] = currentByte
                        mRunningStatus = 0
                        mCount = 1
                        mNeeded = MidiConstants.getBytesPerMessage(currentByte) - 1
                    }
                } else { // real-time?
                    // Single byte message interleaved with other data.
                    if (mInSysEx) {
                        // Buffer this interrupted SysEx message for later
                        mSysExBuffer.write(data, sysExStartOffset, offset - sysExStartOffset)
                        sysExStartOffset = offset + 1
                    }
                    mReceiver.send(data, offset, 1, timestamp)
                }
            } else { // data byte
                if (!mInSysEx) {
                    // Hack to avoid crashing if we start parsing in the middle
                    // of a data stream
                    if (mNeeded <= 0) {
                        break
                    }
                    mBuffer[mCount++] = currentByte
                    if (--mNeeded == 0) {
                        if (mRunningStatus.toInt() != 0) {
                            mBuffer[0] = mRunningStatus
                        }
                        mReceiver.send(mBuffer, 0, mCount, timestamp)
                        mNeeded = MidiConstants.getBytesPerMessage(mBuffer[0]) - 1
                        mCount = 1
                    }
                }
            }
            ++offset
        }
        // send any unfinished SysEx data
        if (sysExStartOffset in 0 until offset) {
            mSysExBuffer.write(data,sysExStartOffset, offset-sysExStartOffset)
        }
    }

    override fun onFlush() {
        mSysExBuffer.reset()
        mCount = 0
        mNeeded = 0
        mInSysEx = false
        super.onFlush()
    }
}