package com.motiz88.reactnativemidi

import android.content.Context
import android.content.pm.PackageManager
import android.media.midi.*
import android.os.Build
import android.os.Handler
import android.os.Looper
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
            midiManager!!.registerDeviceCallback(deviceListener, null)
        }

        OnStopObserving {
            midiManager!!.unregisterDeviceCallback(deviceListener)
            for (id in openDevices.keys) {
                closeDeviceById(id)
            }
        }

        Name("ReactNativeMidi")

        AsyncFunction("requestMIDIAccess") {
            appContext.reactContext?.packageManager?.hasSystemFeature(PackageManager.FEATURE_MIDI) == true
        }

        Function("getDevices") {
            midiManager?.devices?.map { device ->
                serializeDeviceInfo(device)
            }
        }

        AsyncFunction("openDevice") { id: Int, promise: Promise ->
            openDevice(id, promise.butFirst { })
        }

        Function("closeDevice") { id: Int ->
            closeDeviceById(id)
        }

        AsyncFunction("openInputPort") { id: Int, portNumber: Int, promise: Promise ->
            openInputPort(id, portNumber, promise.butFirst { })
        }

        Function("closeInputPort") { id: Int, portNumber: Int ->
            closeInputPort(id, portNumber)
        }

        AsyncFunction("openOutputPort") { id: Int, portNumber: Int, promise: Promise ->
            openOutputPort(id, portNumber, promise.butFirst { })
        }

        Function("closeOutputPort") { id: Int, portNumber: Int ->
            closeOutputPort(id, portNumber)
        }

        Function("send") { id: Int, portNumber: Int, data: Uint8Array, timestamp: Double? ->
            val bytes = ByteArray(data.byteLength)
            data.toDirectBuffer().get(bytes)
            send(id, portNumber, bytes, timestamp)
        }

        Function("flush") { id: Int, portNumber: Int ->
            flush(id, portNumber)
        }

        Function("getMilliTime") {
            System.nanoTime() / 1000000.0
        }
    }

    private fun openDevice(id: Int, promise: Promise) {
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
        openOutputPorts.remove(Pair(id, portNumber))?.close()
    }

    private fun flush(id: Int, portNumber: Int) {
        // TODO: "The implementation will need to ensure the MIDI stream is left in a good state,
        // so if the output port is in the middle of a sysex message, a sysex termination byte (0xf7)
        // should be sent."
        openInputPorts[Pair(id, portNumber)]?.flush()
    }


    private fun openInputPort(id: Int, portNumber: Int, promise: Promise) {
        if (openDevices.containsKey(id)) {
            promise.resolveUsing { openInputPort(id, portNumber) }
        } else {
            openDevice(id, promise.butFirst {
                openInputPort(id, portNumber)
            })
        }
    }

    private fun openInputPort(id: Int, portNumber: Int): MidiInputPort {
        val device = openDevices[id]!!
        val key = Pair(id, portNumber)
        if (!openInputPorts.containsKey(key)) {
            val port = device.openInputPort(portNumber) ?: throw CodedException(
                    "INVALID_ACCESS_ERROR",
                    "Failed to open MIDI port",
                    null
            )
            openInputPorts[key] = port
        }
        return openInputPorts[key]!!
    }

    private fun openOutputPort(id: Int, portNumber: Int, promise: Promise) {
        if (openDevices.containsKey(id)) {
            promise.resolveUsing { openOutputPort(id, portNumber) }
        } else {
            openDevice(id, promise.butFirst {
                openOutputPort(id, portNumber)
            })
        }
    }

    private fun openOutputPort(id: Int, portNumber: Int): MidiOutputPort {
        val device = openDevices[id]!!
        val key = Pair(id, portNumber)
        if (!openOutputPorts.containsKey(key)) {
            val port = device.openOutputPort(portNumber) ?: throw CodedException(
                    "INVALID_ACCESS_ERROR",
                    "Failed to open MIDI port",
                    null
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
            openOutputPorts[key] = port
        }
        return openOutputPorts[key]!!
    }

    private fun send(
            id: Int,
            portNumber: Int,
            bytes: ByteArray,
            timestamp: Double?
    ) {
        val key = Pair(id, portNumber)
        val port = openInputPorts[key]!!
        port.send(bytes, 0, bytes.size, ((timestamp ?: 0.0) * 1000000.0).toLong())
    }

    private fun closeInputPort(id: Int, portNumber: Int) {
        openInputPorts.remove(Pair(id, portNumber))?.close()
    }

    private val openDevices = HashMap<Int, MidiDevice>()
    private val openInputPorts = HashMap<Pair<Int, Int>, MidiInputPort>()
    private val openOutputPorts = HashMap<Pair<Int, Int>, MidiOutputPort>()

    private val deviceListener = object : MidiManager.DeviceCallback() {
        override fun onDeviceAdded(device: MidiDeviceInfo) {
            this@ReactNativeMidiModule.sendEvent(
                    MIDI_DEVICE_ADDED_EVENT_NAME,
                    serializeDeviceInfo(device)
            )
        }

        override fun onDeviceRemoved(device: MidiDeviceInfo) {
            closeDeviceById(device.id)
            this@ReactNativeMidiModule.sendEvent(
                    MIDI_DEVICE_REMOVED_EVENT_NAME,
                    bundleOf("id" to device.id)
            )
        }
    }

    private fun closeDeviceById(id: Int) {
        openDevices.remove(id)?.close()
        openInputPorts.keys.removeAll { it.first == id }
        openOutputPorts.keys.removeAll { it.first == id }
    }
}
