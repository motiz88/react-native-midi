//
//  SourcePort.swift
//  ReactNativeMidi
//
//  Created by Moti Zilberman on 22/12/2022.
//

import CoreMIDI
import Foundation
import Gong

class MidiConstants {
    /** Number of bytes in a message nc from 8c to Ec  */
    private static let CHANNEL_BYTE_LENGTHS: [Int] = [3, 3, 3, 3, 2, 2, 3]

    /** Number of bytes in a message Fn from F0 to FF  */
    private static let SYSTEM_BYTE_LENGTHS: [Int] = [
        1, 2, 3, 2, 1, 1, 1, 1, 1,
        1, 1, 1, 1, 1, 1, 1,
    ]

    /**
     * MIDI messages, except for SysEx, are 1,2 or 3 bytes long.
     * You can tell how long a MIDI message is from the first status byte.
     * Do not call this for SysEx, which has variable length.
     * @param statusByte
     * @return number of bytes in a complete message or zero if data byte passed
     */
    public static func getBytesPerMessage(_ statusByte: UInt8) -> Int {
        if statusByte >= 0xF0 {
            // System messages use low nibble for size.
            return SYSTEM_BYTE_LENGTHS[Int(statusByte & 0x0F)]
        } else if statusByte >= 0x80 {
            // Channel voice messages use high nibble for size.
            return CHANNEL_BYTE_LENGTHS[Int((statusByte >> 4) - 8)]
        } else {
            return 0 // data byte
        }
    }
}

public extension MIDIClient {
    typealias MutPacketCallback = (_ packet: UnsafePointer<MIDIPacket>, _ source: MIDISource) -> Void

    func createInput2(name: String, callback: @escaping MutPacketCallback = { _, _ in }) throws -> MIDIInput {
        var portReference = MIDIPortRef()

        let context = UnsafeMutablePointer<MutPacketCallback>.allocate(capacity: 1)
        context.initialize(to: callback)

        let procedure: MIDIReadProc = { packetList, context, connectionContext in
            guard let callback = context?.assumingMemoryBound(to: MutPacketCallback.self).pointee else {
                return
            }

            guard let endpointReference = connectionContext?.assumingMemoryBound(to: MIDIEndpointRef.self).pointee else {
                return
            }
            var packet: UnsafePointer<MIDIPacket>? = packetList.pointer(to: \.packet)!.withMemoryRebound(to: MIDIPacket.self, capacity: 1) {
                $0
            }
            for _ in 0 ..< packetList.pointee.numPackets {
                callback(packet!, MIDISource(endpointReference))
                packet = UnsafePointer(MIDIPacketNext(packet!))
            }
        }

        try MIDIInputPortCreate(reference, name as CFString, procedure, context, &portReference).midiError("Creating input port on MIDIClient with name \"\(name)\"")
        return MIDIInput(portReference)
    }
}

class SourcePort {
    private let client: MIDIClient
    private let source: MIDISource
    private var input: MIDIInput?
    private let sendSingleMessage: (ArraySlice<UInt8>, MIDITimeStamp) -> Void

    private var mBuffer: [UInt8] = [0, 0, 0]
    private var mSysExBuffer: [UInt8] = []
    private var mCount = 0
    private var mRunningStatus: UInt8 = 0
    private var mNeeded = 0
    private var mInSysEx = false

    private func receive(_ packet: UnsafePointer<MIDIPacket>, from _: MIDISource) {
        let count = Int(packet.pointee.length)
        let data = packet.pointer(to: \.data)!.withMemoryRebound(to: UInt8.self, capacity: count) {
            [UInt8](UnsafeBufferPointer(start: $0, count: count))
        }
        var offset = 0
        var sysExStartOffset = mInSysEx ? offset : -1
        for _ in 0 ..< count {
            let currentByte = data[offset]
            if currentByte >= 0x80 { // status byte?
                if currentByte < 0xF0 { // channel message?
                    mRunningStatus = currentByte
                    mCount = 1
                    mNeeded = MidiConstants.getBytesPerMessage(currentByte) - 1
                } else if currentByte < 0xF8 { // system common?
                    if currentByte == 0xF0 /* SysEx Start */ {
                        mInSysEx = true
                        sysExStartOffset = offset
                    } else if currentByte == 0xF7 /* SysEx End */ {
                        if mInSysEx {
                            if mSysExBuffer.count > 0 {
                                // Completing a previously incomplete SysEx message - copy into a
                                // contiguous buffer and send all at once
                                mSysExBuffer.append(contentsOf: data[sysExStartOffset ... offset])
                                sendSingleMessage(mSysExBuffer[...], packet.pointee.timeStamp)
                                mSysExBuffer.removeAll()
                            } else {
                                // SysEx message that starts and ends within `data`
                                sendSingleMessage(data[sysExStartOffset ... offset], packet.pointee.timeStamp)
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
                    if mInSysEx {
                        // Buffer this interrupted SysEx message for later
                        mSysExBuffer.append(contentsOf: data[sysExStartOffset ..< offset])
                        sysExStartOffset = offset + 1
                    }
                    sendSingleMessage(data[offset ... offset], packet.pointee.timeStamp)
                }
            } else { // data byte
                if !mInSysEx {
                    // Hack to avoid crashing if we start parsing in the middle
                    // of a data stream
                    if mNeeded <= 0 {
                        break
                    }
                    mBuffer[mCount] = currentByte
                    mCount += 1
                    mNeeded -= 1
                    if mNeeded == 0 {
                        if Int(mRunningStatus) != 0 {
                            mBuffer[0] = mRunningStatus
                        }
                        sendSingleMessage(mBuffer[0 ..< mCount], packet.pointee.timeStamp)
                        mNeeded = MidiConstants.getBytesPerMessage(mBuffer[0]) - 1
                        mCount = 1
                    }
                }
            }
            offset += 1
        }
        // send any unfinished SysEx data
        if sysExStartOffset >= 0 && sysExStartOffset < offset {
            mSysExBuffer.append(contentsOf: data[sysExStartOffset ..< offset])
        }
    }

    init(with client: MIDIClient, source: MIDISource, sendSingleMessage: @escaping (ArraySlice<UInt8>, MIDITimeStamp) -> Void) throws {
        self.client = client
        self.source = source
        self.sendSingleMessage = sendSingleMessage
        input = try client.createInput2(name: "Default input", callback: receive)
        try input!.connect(self.source)
    }

    deinit {
        do {
            try self.input?.disconnect(self.source)
        } catch {}
    }
}
