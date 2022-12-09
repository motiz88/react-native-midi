package com.motiz88.reactnativemidi

import android.content.Context
import android.content.pm.PackageManager
import android.media.midi.*
import android.os.Build
import androidx.annotation.RequiresApi
import androidx.core.os.bundleOf
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.typedarray.Uint8Array

const val MIDI_DEVICES_CHANGED_EVENT_NAME = "onMidiDevicesChanged"

@RequiresApi(Build.VERSION_CODES.M)
class ReactNativeMidiModule : Module() {
    private val midiManager: MidiManager?
        get() = appContext.reactContext?.getSystemService(Context.MIDI_SERVICE) as? MidiManager

    override fun definition() = ModuleDefinition {
        Events(MIDI_DEVICES_CHANGED_EVENT_NAME)

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
                bundleOf(
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
            }
        }

        AsyncFunction("openDevice") { id: Int, promise: Promise ->
            val device = openDevices[id]
            if (device != null) {
                promise.resolve(null)
            } else {
                (midiManager?.devices?.find { device -> device.id == id }
                    ?: throw NoSuchElementException("No such device")).let {
                    midiManager!!.openDevice(
                        it, MidiManager.OnDeviceOpenedListener { device ->
                            if (device != null) {
                                openDevices[id] = device
                                promise.resolve(null)
                            } else if (openDevices.containsKey(id)) {
                                // race condition, should be fine to report as a successful open
                                promise.resolve(null)
                            } else {
                                promise.reject(CodedException("Failed to open device"))
                            }
                        },
                        null
                    )
                }
            }
        }

        Function("closeDevice") { id: Int ->
            closeDeviceById(id)
        }

        Function("openInputPort") { id: Int, portNumber: Int ->
            openInputPort(id, portNumber)
            Unit
        }

        Function("closeInputPort") { id: Int, portNumber: Int ->
            closeInputPort(id, portNumber)
        }

        Function("openOutputPort") { id: Int, portNumber: Int ->
            openOutputPort(id, portNumber)
            Unit
        }

        Function("closeOutputPort") { id: Int, portNumber: Int ->
            closeOutputPort(id, portNumber)
        }

        Function("send") {
            // TODO: timestamp
                id: Int, portNumber: Int, data: Uint8Array ->
            send(id, portNumber, data)
        }

        Function("flush") { id: Int, portNumber: Int ->
            flush(id, portNumber)
        }
    }

    private fun closeOutputPort(id: Int, portNumber: Int) =
        openOutputPorts.remove(Pair(id, portNumber))?.close()

    private fun flush(id: Int, portNumber: Int) =
        openInputPorts[Pair(id, portNumber)]?.flush()


    private fun openInputPort(id: Int, portNumber: Int): MidiInputPort {
        // TODO: auto-open?
        val device = openDevices[id]!!
        val key = Pair(id, portNumber)
        if (!openInputPorts.containsKey(key)) {
            openInputPorts[key] = device.openInputPort(portNumber)
        }
        return openInputPorts[key]!!
    }

    private fun openOutputPort(id: Int, portNumber: Int): MidiOutputPort {
        // TODO: auto-open?
        val device = openDevices[id]!!
        val key = Pair(id, portNumber)
        if (!openOutputPorts.containsKey(key))
            openOutputPorts[key] = device.openOutputPort(portNumber)
        return openOutputPorts[key]!!
    }

    private fun send(
        id: Int,
        portNumber: Int,
        data: Uint8Array
    ) {
        val port = openInputPort(id, portNumber)
        val bytes = ByteArray(data.byteLength)
        data.toDirectBuffer().get(bytes)
        port.send(bytes, 0, bytes.size)
    }

    private fun closeInputPort(id: Int, portNumber: Int) =
        openInputPorts.remove(Pair(id, portNumber))?.close()


    private val openDevices = HashMap<Int, MidiDevice>()
    private val openInputPorts = HashMap<Pair<Int, Int>, MidiInputPort>()
    private val openOutputPorts = HashMap<Pair<Int, Int>, MidiOutputPort>()

    private val deviceListener = object : MidiManager.DeviceCallback() {
        override fun onDeviceAdded(device: MidiDeviceInfo) {
            this@ReactNativeMidiModule.sendEvent(
                MIDI_DEVICES_CHANGED_EVENT_NAME,
                bundleOf("id" to device.id)
            )
        }

        override fun onDeviceRemoved(device: MidiDeviceInfo) {
            closeDeviceById(device.id)
            this@ReactNativeMidiModule.sendEvent(
                MIDI_DEVICES_CHANGED_EVENT_NAME,
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
