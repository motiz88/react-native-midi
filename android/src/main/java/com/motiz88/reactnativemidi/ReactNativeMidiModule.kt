package com.motiz88.reactnativemidi

import android.content.Context
import android.content.pm.PackageManager
import android.media.midi.*
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.annotation.RequiresApi
import androidx.core.os.bundleOf
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.typedarray.Uint8Array

const val MIDI_DEVICE_ADDED_EVENT_NAME = "onMidiDeviceAdded"
const val MIDI_DEVICE_REMOVED_EVENT_NAME = "onMidiDeviceRemoved"
const val MIDI_MESSAGE_RECEIVED_EVENT_NAME = "onMidiMessageReceived"

fun Promise.butFirst(mapper: (Any?) -> Any?): Promise {
    val nextPromise = this
    return object : Promise {
        override fun resolve(value: Any?) {
            val result: Any?
            try {
                result = mapper(value)
            } catch (e: CodedException) {
                nextPromise.reject(e)
                return
            } catch (e: Throwable) {
                nextPromise.reject(CodedException(e))
                return
            }
            nextPromise.resolve(result)
        }

        override fun reject(code: String, message: String?, cause: Throwable?) {
            nextPromise.reject(code, message, cause)
        }
    }
}

fun Promise.resolveUsing(mapper: () -> Any?) {
    val result: Any?
    try {
        result = mapper()
    } catch (e: CodedException) {
        this.reject(e)
        return
    } catch (e: Throwable) {
        this.reject(CodedException(e))
        return
    }
    this.resolve(result)
}

@RequiresApi(Build.VERSION_CODES.M)
class ReactNativeMidiModule : Module() {
    private val midiManager: MidiManager?
        get() = appContext.reactContext?.getSystemService(Context.MIDI_SERVICE) as? MidiManager

    override fun definition() = ModuleDefinition {
        Events(
            MIDI_DEVICE_ADDED_EVENT_NAME,
            MIDI_DEVICE_REMOVED_EVENT_NAME,
            MIDI_MESSAGE_RECEIVED_EVENT_NAME,
        )

        OnStartObserving {
            Log.d("ReactNativeMidiModule", "OnStartObserving")
            midiManager!!.registerDeviceCallback(deviceListener, null)
        }

        OnStopObserving {
            Log.d("ReactNativeMidiModule", "OnStopObserving")
            midiManager!!.unregisterDeviceCallback(deviceListener)
            for (id in openDevices.keys) {
                closeDeviceById(id)
            }
        }

        Name("ReactNativeMidi")

        AsyncFunction("requestMIDIAccess") {
            Log.d("ReactNativeMidiModule", "JS --> requestMIDIAccess")
            appContext.reactContext?.packageManager?.hasSystemFeature(PackageManager.FEATURE_MIDI) == true
        }

        Function("getDevices") {
            Log.d("ReactNativeMidiModule", "JS --> getDevices")
            midiManager?.devices?.map { device ->
                serializeDeviceInfo(device)
            }
        }

        AsyncFunction("openDevice") { id: Int, promise: Promise ->
            Log.d("ReactNativeMidiModule", "JS --> openDevice $id")
            openDevice(id, promise.butFirst { })
        }

        Function("closeDevice") { id: Int ->
            Log.d("ReactNativeMidiModule", "JS --> closeDevice $id")
            closeDeviceById(id)
        }

        AsyncFunction("openInputPort") { id: Int, portNumber: Int, promise: Promise ->
            Log.d("ReactNativeMidiModule", "JS --> openInputPort $id, $portNumber")
            openInputPort(id, portNumber, promise.butFirst { })
        }

        Function("closeInputPort") { id: Int, portNumber: Int ->
            Log.d("ReactNativeMidiModule", "JS --> closeInputPort $id, $portNumber")
            closeInputPort(id, portNumber)
        }

        AsyncFunction("openOutputPort") { id: Int, portNumber: Int, promise: Promise ->
            Log.d("ReactNativeMidiModule", "JS --> openOutputPort $id, $portNumber")
            openOutputPort(id, portNumber, promise.butFirst { })
        }

        Function("closeOutputPort") { id: Int, portNumber: Int ->
            Log.d("ReactNativeMidiModule", "JS --> closeOutputPort $id, $portNumber")
            closeOutputPort(id, portNumber)
        }

        AsyncFunction("send") { id: Int, portNumber: Int, data: Uint8Array, timestamp: Double?,
                                promise: Promise ->
            Log.d("ReactNativeMidiModule", "JS --> send to $id, $portNumber")
            send(id, portNumber, data, timestamp, promise.butFirst { })
        }

        Function("flush") { id: Int, portNumber: Int ->
            Log.d("ReactNativeMidiModule", "JS --> flush $id, $portNumber")
            flush(id, portNumber)
        }

        Function("getMilliTime") {
            Log.d("ReactNativeMidiModule", "JS --> getMilliTime")
            System.nanoTime() / 1000000.0
        }
    }

    private fun openDevice(id: Int, promise: Promise) {
        Log.d("ReactNativeMidiModule", "openDevice $id")
        val device = openDevices[id]
        if (device != null) {
            promise.resolve(device)
            return
        }
        val deviceInfo = midiManager?.devices?.find { it.id == id }
        if (deviceInfo == null) {
            promise.reject(CodedException("No such device"))
            return
        }
        midiManager!!.openDevice(deviceInfo, {
            if (it == null) {
                promise.reject(CodedException("Failed to open device"))
            } else {
                openDevices[id] = it
                promise.resolve(it)
            }
        }, Handler(Looper.myLooper()!!))
    }

    private fun serializeDeviceInfo(device: MidiDeviceInfo) = bundleOf(
        "id" to device.id,
        "inputPortCount" to device.inputPortCount,
        "outputPortCount" to device.outputPortCount,
        "isPrivate" to device.isPrivate,
        "properties" to bundleOf(
            "manufacturer" to device.properties.get("manufacturer"),
            "name" to device.properties.get("name"),
            "product" to device.properties.get("product"),
            "serial_number" to device.properties.get("serial_number"),
            "version" to device.properties.get("version"),
        ),
        "type" to device.type,
        "ports" to device.ports.map { port ->
            bundleOf(
                "type" to port.type,
                "name" to port.name,
                "portNumber" to port.portNumber,
            )
        }
    )

    private fun closeOutputPort(id: Int, portNumber: Int) {
        Log.d("ReactNativeMidiModule", "closeOutputPort $id, $portNumber")
        openOutputPorts.remove(Pair(id, portNumber))?.close()
    }

    private fun flush(id: Int, portNumber: Int) {
        Log.d("ReactNativeMidiModule", "flush $id, $portNumber")
        // TODO: "The implementation will need to ensure the MIDI stream is left in a good state,
        // so if the output port is in the middle of a sysex message, a sysex termination byte (0xf7)
        // should be sent."
        openInputPorts[Pair(id, portNumber)]?.flush()
    }


    private fun openInputPort(id: Int, portNumber: Int, promise: Promise) {
        Log.d("ReactNativeMidiModule", "openInputPort $id, $portNumber")
        if (openDevices.containsKey(id)) {
            Log.d(
                "ReactNativeMidiModule",
                "openInputPort $id, $portNumber: device is already open, opening port"
            )
            promise.resolveUsing { openInputPort(id, portNumber) }
        } else {
            Log.d("ReactNativeMidiModule", "openInputPort $id, $portNumber: device is not open")
            openDevice(id, promise.butFirst {
                Log.d(
                    "ReactNativeMidiModule",
                    "openInputPort $id, $portNumber: done opening device, opening port"
                )
                openInputPort(id, portNumber)
            })
        }
    }

    private fun openInputPort(id: Int, portNumber: Int): MidiInputPort {
        Log.d("ReactNativeMidiModule", "openInputPort $id, $portNumber: asserting device is open")
        val device = openDevices[id]!!
        val key = Pair(id, portNumber)
        if (!openInputPorts.containsKey(key)) {
            Log.d("ReactNativeMidiModule", "openInputPort $id, $portNumber: opening port")
            val port = device.openInputPort(portNumber) ?: throw CodedException(
                "INVALID_ACCESS_ERROR",
                "Failed to open MIDI port",
                null
            )
            openInputPorts[key] = port
        } else {
            Log.d("ReactNativeMidiModule", "openInputPort $id, $portNumber: port is already open")
        }
        return openInputPorts[key]!!
    }

    private fun openOutputPort(id: Int, portNumber: Int, promise: Promise) {
        Log.d("ReactNativeMidiModule", "openOutputPort $id, $portNumber")
        if (openDevices.containsKey(id)) {
            Log.d(
                "ReactNativeMidiModule",
                "openOutputPort $id, $portNumber: device is already open, opening port"
            )
            promise.resolveUsing { openOutputPort(id, portNumber) }
        } else {
            Log.d("ReactNativeMidiModule", "openOutputPort $id, $portNumber: device is not open")
            openDevice(id, promise.butFirst {
                Log.d(
                    "ReactNativeMidiModule",
                    "openOutputPort $id, $portNumber: done opening device, opening port"
                )
                openOutputPort(id, portNumber)
            })
        }
    }

    private fun openOutputPort(id: Int, portNumber: Int): MidiOutputPort {
        Log.d("ReactNativeMidiModule", "openOutputPort $id, $portNumber: asserting device is open")
        val device = openDevices[id]!!
        val key = Pair(id, portNumber)
        if (!openOutputPorts.containsKey(key)) {
            Log.d("ReactNativeMidiModule", "openOutputPort $id, $portNumber: opening port")
            val port = device.openOutputPort(portNumber) ?: throw CodedException(
                "INVALID_ACCESS_ERROR",
                "Failed to open MIDI port",
                null
            )
            Log.d(
                "ReactNativeMidiModule",
                "openOutputPort $id, $portNumber: opened"
            )

            port.connect(MidiFramer(object : MidiReceiver() {
                override fun onSend(msg: ByteArray, offset: Int, count: Int, timestamp: Long) {
                    this@ReactNativeMidiModule.sendEvent(
                        MIDI_MESSAGE_RECEIVED_EVENT_NAME,
                        bundleOf(
                            "id" to id,
                            "portNumber" to portNumber,
                            // TODO: OMG no, pass an actual byte array with no copying
                            "data" to msg.slice(offset until offset + count)
                                .map { it.toInt() }.toIntArray(),
                            "timestamp" to timestamp / 1000000.0
                        )
                    )
                }
            }))
            Log.d(
                "ReactNativeMidiModule",
                "openOutputPort $id, $portNumber: connected"
            )
            openOutputPorts[key] = port
        } else {
            Log.d("ReactNativeMidiModule", "openOutputPort $id, $portNumber: port already open")
        }
        return openOutputPorts[key]!!
    }

    private fun send(
        id: Int,
        portNumber: Int,
        data: Uint8Array,
        timestamp: Double?,
        promise: Promise
    ) {
        Log.d(
            "ReactNativeMidiModule",
            "send $id, $portNumber"
        )
        val key = Pair(id, portNumber)
        if (openInputPorts.containsKey(key)) {
            Log.d(
                "ReactNativeMidiModule",
                "send $id, $portNumber: port is already open"
            )
            promise.resolveUsing { send(id, portNumber, data, timestamp) }
        } else {
            Log.d(
                "ReactNativeMidiModule",
                "send $id, $portNumber: port is not open"
            )
            openInputPort(
                id,
                portNumber,
                promise.butFirst {
                    Log.d(
                        "ReactNativeMidiModule",
                        "send $id, $portNumber: done opening port, attempting to send"
                    )
                    send(id, portNumber, data, timestamp)
                })
        }
    }

    private fun send(
        id: Int,
        portNumber: Int,
        data: Uint8Array,
        timestamp: Double?
    ) {
        val key = Pair(id, portNumber)
        Log.d(
            "ReactNativeMidiModule",
            "send $id, $portNumber: asserting port is open"
        )
        val port = openInputPorts[key]!!
        val bytes = ByteArray(data.byteLength)
        data.toDirectBuffer().get(bytes)
        Log.d(
            "ReactNativeMidiModule",
            "send $id, $portNumber: writing to port"
        )
        port.send(bytes, 0, bytes.size, ((timestamp ?: 0.0) * 1000000.0).toLong())
    }

    private fun closeInputPort(id: Int, portNumber: Int) {
        Log.d(
            "ReactNativeMidiModule",
            "closeInputPort $id, $portNumber: closing and removing port (if it exists)"
        )
        openInputPorts.remove(Pair(id, portNumber))?.close()
    }

    private val openDevices = HashMap<Int, MidiDevice>()
    private val openInputPorts = HashMap<Pair<Int, Int>, MidiInputPort>()
    private val openOutputPorts = HashMap<Pair<Int, Int>, MidiOutputPort>()

    private val deviceListener = object : MidiManager.DeviceCallback() {
        override fun onDeviceAdded(device: MidiDeviceInfo) {
            Log.d(
                "ReactNativeMidiModule",
                "onDeviceAdded ${device.id}"
            )
            this@ReactNativeMidiModule.sendEvent(
                MIDI_DEVICE_ADDED_EVENT_NAME,
                serializeDeviceInfo(device)
            )
        }

        override fun onDeviceRemoved(device: MidiDeviceInfo) {
            Log.d(
                "ReactNativeMidiModule",
                "onDeviceRemoved ${device.id}"
            )
            closeDeviceById(device.id)
            this@ReactNativeMidiModule.sendEvent(
                MIDI_DEVICE_REMOVED_EVENT_NAME,
                bundleOf("id" to device.id)
            )
        }
    }

    private fun closeDeviceById(id: Int) {
        Log.d(
            "ReactNativeMidiModule",
            "closeDeviceById $id"
        )
        openDevices.remove(id)?.close()
        openInputPorts.keys.removeAll { it.first == id }
        openOutputPorts.keys.removeAll { it.first == id }
    }
}
