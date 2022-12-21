import * as ReactNativeMidi from "./ReactNativeMidi";

const time0Js = performance.now();
let time0Native = ReactNativeMidi.getMilliTime(); // takes a non-negligible time to return
const roundTripTime = performance.now() - time0Js;
// adjust time0Native to be closer to the real time at time0Js
time0Native -= roundTripTime;

export function convertTimestampToNative(timestampJs: number): number {
  return timestampJs - time0Js + time0Native;
}

export function convertTimestampFromNative(timestampNative: number): number {
  return timestampNative - time0Native + time0Js;
}
