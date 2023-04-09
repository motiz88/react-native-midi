import ExpoModulesCore
import Gong

let MIDI_DEVICE_ADDED_EVENT_NAME = "onMidiDeviceAdded"
let MIDI_DEVICE_REMOVED_EVENT_NAME = "onMidiDeviceRemoved"
let MIDI_MESSAGE_RECEIVED_EVENT_NAME = "onMidiMessageReceived"

public class ReactNativeMidiModule: Module {

    private func addDevice(device: MIDIDevice) {
        sendEvent(MIDI_DEVICE_ADDED_EVENT_NAME, ReactNativeMidiModule.serializeDeviceInfo(device: device))
    }

    private func removeDevice(device: MIDIDevice) {
        sendEvent(MIDI_DEVICE_REMOVED_EVENT_NAME, ["id": device.properties![MIDIObject.Property.uniqueID]])
    }

    private func receive(notice: MIDINotice) {
        switch notice {
        case let .objectAdded(_, device as MIDIDevice):
            // NOTE: I haven't seen this event fire in practice with MIDIDevice as the child.
            let offline = device.properties![MIDIObject.Property.offline] as? Int
            if (offline == nil || offline == 0) {
                addDevice(device: device)
            }
            break;
        case let .objectRemoved(_, device as MIDIDevice):
            // NOTE: I haven't seen this event fire in practice with MIDIDevice as the child.
            removeDevice(device: device)
            break;
        case let .propertyChanged(device as MIDIDevice, MIDIObject.Property.offline):
            let offline = device.properties![MIDIObject.Property.offline] as! Int
            if (offline == 0) {
                addDevice(device: device)
            } else {
                removeDevice(device: device)
            }
            break;
        // TODO: Handle other property changes?
        // TODO: Handle individual endpoints being added/removed?
        default:
            break
        }
    }

    private var client: MIDIClient?

    private var output: MIDIOutput?

    private func openDevice(id _: Int32, promise: Promise) {
        promise.resolve(nil)
    }

    private static func serializeDeviceInfo(device: MIDIDevice) -> [String: Any?] {
        return [
            "id": device.properties![MIDIObject.Property.uniqueID],
            "inputPortCount": device.destinations.count,
            "outputPortCount": device.sources.count,
            "isPrivate": device.properties![MIDIObject.Property.private],
            "properties": [
                "manufacturer": device.properties![MIDIObject.Property.manufacturer],
                "name": device.properties![MIDIObject.Property.name],
                "device_id": device.properties![MIDIObject.Property.deviceID],
                "model": device.properties![MIDIObject.Property.model],
            ],
            "ports": device.destinations.map { port in [
                "type": 1,
                "name": device.properties![MIDIObject.Property.name],
                "portNumber": port.properties![MIDIObject.Property.uniqueID],
            ]
            } + device.sources.map { port in [
                "type": 2,
                "name": device.properties![MIDIObject.Property.name],
                "portNumber": port.properties![MIDIObject.Property.uniqueID],
            ]
            },
        ]
    }

    private func getDevices() -> [[String: Any?]] {
        return MIDIDevice.all
            // iOS reports *every device ever seen* as "offline".
            // In Web MIDI terms we interpret "offline" as "disconnected", and disconnected
            // ports should not be listed in MIDIAccess, so just filter them out.
            .filter {$0.properties![MIDIObject.Property.offline] as? Int != 1 }
            .map(ReactNativeMidiModule.serializeDeviceInfo)
    }

    private func closeDevice(id: Int32) {
        // TODO: Is this safe, or can `source` change, forcing us to do our own bookkeeping?
        MIDIDevice.find(with: id)?.sources.forEach {
            closeOutputPort(id: id, portNumber: $0.properties![MIDIObject.Property.uniqueID] as! Int32)
        }
    }

    private static func getMilliTime() -> Double {
        let time = mach_absolute_time()
        var timeBaseInfo = mach_timebase_info_data_t()
        mach_timebase_info(&timeBaseInfo)
        let timeInNanoSeconds = Double(time) * Double(timeBaseInfo.numer) / Double(timeBaseInfo.denom)
        return timeInNanoSeconds / 1_000_000.0
    }

    private func openInputPort(id _: Int32, portNumber _: Int32, promise: Promise) {
        promise.resolve(nil)
    }

    private func closeInputPort(id _: Int32, portNumber _: Int32) {}

    private var openSourcePorts: [Int32: SourcePort] = [:]

    private func openOutputPort(id: Int32, portNumber: Int32, promise: Promise) {
        let doOpen = { [self] in
            do {
                if openSourcePorts[portNumber] == nil {
                    let source = MIDISource.find(with: MIDIUniqueID(portNumber))
                    openSourcePorts[portNumber] = try SourcePort(with: client!, source: source!) { data, timestamp in
                        self.sendEvent(MIDI_MESSAGE_RECEIVED_EVENT_NAME, [
                            "id": id,
                            "portNumber": portNumber,
                            "data": Array(data),
                            "timestamp": Double(timestamp) / 1_000_000.0,
                        ])
                    }
                }
                promise.resolve(nil)
            } catch {
                promise.reject(error)
            }
        }
        if (client != nil) {
            doOpen()
            return
        } else {
            // Assume there is a concurrent requestMidiAccess() call in progress and get in the queue behind it.
            DispatchQueue.main.async(execute: doOpen)
        }
    }

    private func closeOutputPort(id _: Int32, portNumber: Int32) {
        openSourcePorts.removeValue(forKey: portNumber)
    }

    private func send(id _: Int32, portNumber: Int32, message: Uint8Array, timestamp: Double?, promise: Promise) {
        // AsyncFunction executes on a different thread, and we must be on the main thread to access `message` and `output`
        DispatchQueue.main.async { [self] in
            do {
                let destination = MIDIDestination.find(with: MIDIUniqueID(portNumber))
                let uint8Ptr = message.rawPointer.bindMemory(to: UInt8.self, capacity: message.length)
                let uint8Buf = UnsafeBufferPointer(start: uint8Ptr, count: message.length)
                // TODO: Long messages (break into multiple packets?)
                let midiTimestamp = UInt64(((timestamp != nil) ? (timestamp! * 1_000_000.0) : 0).rounded())
                try output!.send(
                    bytes: Array(uint8Buf), timestamp: midiTimestamp, to: destination!
                )
                promise.resolve(nil)
            } catch {
                promise.reject(error)
            }
        }
    }

    private func flush(id _: Int32, portNumber: Int32) throws {
        // TODO: "The implementation will need to ensure the MIDI stream is left in a good state,
        // so if the output port is in the middle of a sysex message, a sysex termination byte (0xf7)
        // should be sent."
        let destination = MIDIDestination.find(with: MIDIUniqueID(portNumber))
        try destination!.flushOutput()
    }

    private func requestMIDIAccess(promise: Promise) {
        DispatchQueue.main.async { [self] in
            do {
                if (client != nil) {
                    promise.resolve(true)
                    return
                }
                client = try MIDIClient(name: "@motiz88/react-native-midi", callback: self.receive)
                output = try client!.createOutput(name: "@motiz88/react-native-midi output")
            } catch {
                promise.reject(error)
                return
            }
            promise.resolve(true)
        }
    }

    public func definition() -> ModuleDefinition {
        Name("ReactNativeMidi")

        Events(MIDI_DEVICE_ADDED_EVENT_NAME, MIDI_DEVICE_REMOVED_EVENT_NAME, MIDI_MESSAGE_RECEIVED_EVENT_NAME)

        AsyncFunction("requestMIDIAccess", requestMIDIAccess)

        Function("getDevices", getDevices)

        AsyncFunction("openDevice", openDevice)

        Function("closeDevice", closeDevice)

        AsyncFunction("openInputPort", openInputPort)

        Function("closeInputPort", closeInputPort)

        AsyncFunction("openOutputPort", openOutputPort)

        Function("closeOutputPort", closeOutputPort)

        AsyncFunction("send", send)

        Function("flush", flush)

        Function("getMilliTime", ReactNativeMidiModule.getMilliTime)
    }
}
