//
//  MIDIExtensions.swift
//  ReactNativeMidi
//
//  Created by Moti Zilberman on 22/12/2022.
//

import CoreMIDI
import Foundation
import Gong

public extension MIDIDestination {
    static func find(with uniqueID: MIDIUniqueID) -> MIDIDestination? {
        let obj = MIDIObject.find(with: uniqueID, type: .destination)
        if obj == nil {
            return nil
        }
        return MIDIDestination(obj!.reference)
    }
}

public extension MIDISource {
    static func find(with uniqueID: MIDIUniqueID) -> MIDISource? {
        let obj = MIDIObject.find(with: uniqueID, type: .source)
        if obj == nil {
            return nil
        }
        return MIDISource(obj!.reference)
    }
}

public extension MIDIDevice {
    static func find(with uniqueID: MIDIUniqueID) -> MIDIDevice? {
        let obj = MIDIObject.find(with: uniqueID, type: .device)
        if obj == nil {
            return nil
        }
        return MIDIDevice(obj!.reference)
    }
}

public extension MIDIOutput {
    func send(bytes: [UInt8], timestamp: MIDITimeStamp, to destination: MIDIDestination) throws {
        let builder = MIDIPacketList.Builder(byteSize: MemoryLayout<MIDIPacketList>.size + ((bytes.count + 255) / 256) * MemoryLayout<MIDIPacket>.size)
        builder.append(timestamp: timestamp, data: bytes)
        var status = noErr
        builder.withUnsafePointer {
            status = MIDISend(reference, destination.reference, $0)
        }
        try status.midiError("Sending packets to destination with MIDIOutput")
    }
}
