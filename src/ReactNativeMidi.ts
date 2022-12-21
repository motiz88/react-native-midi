import { NativeModulesProxy, EventEmitter } from "expo-modules-core";

import ReactNativeMidiModule from "./ReactNativeMidiModule";

export const emitter = new EventEmitter(
  ReactNativeMidiModule ?? NativeModulesProxy.ReactNativeMidi
);

export function flush(deviceId: number, portNumber: number) {
  ReactNativeMidiModule.flush(deviceId, portNumber);
}

export async function send(
  deviceId: number,
  portNumber: number,
  data: Uint8Array,
  timestamp?: number
) {
  return await ReactNativeMidiModule.send(
    deviceId,
    portNumber,
    data,
    timestamp,
    // Extra parameter to work around Expo bug
    // Can be cleaned up when https://github.com/expo/expo/pull/20419 ships
    0
  );
}

export async function openDevice(deviceId: number): Promise<void> {
  return await ReactNativeMidiModule.openDevice(deviceId);
}

export async function openInputPort(
  deviceId: number,
  portNumber: number
): Promise<void> {
  return await ReactNativeMidiModule.openInputPort(deviceId, portNumber);
}

export async function openOutputPort(
  deviceId: number,
  portNumber: number
): Promise<void> {
  return await ReactNativeMidiModule.openOutputPort(deviceId, portNumber);
}

export function closeInputPort(deviceId: number, portNumber: number) {
  ReactNativeMidiModule.closeInputPort(deviceId, portNumber);
}

export function closeOutputPort(deviceId: number, portNumber: number) {
  ReactNativeMidiModule.closeOutputPort(deviceId, portNumber);
}

export function getDevices(): AndroidDeviceInfo[] {
  return ReactNativeMidiModule.getDevices();
}

export async function requestMIDIAccess(): Promise<boolean> {
  return await ReactNativeMidiModule.requestMIDIAccess();
}

export function getMilliTime(): number {
  return ReactNativeMidiModule.getMilliTime();
}

export enum AndroidPortType {
  Input = 1,
  Output = 2,
}

export enum AndroidDeviceType {
  USB = 1,
  Virtual = 2,
  Bluetooth = 3,
}

export type AndroidPortInfo = {
  type: AndroidPortType;
  name: string;
  portNumber: number;
};

export type AndroidDeviceInfo = {
  id: number;
  inputPortCount: number;
  outputPortCount: number;
  isPrivate: boolean;
  properties: {
    manufacturer: string;
    name: string;
    product: string;
    serial_number: string;
    version: string;
  };
  type: AndroidDeviceType;
  ports: AndroidPortInfo[];
};