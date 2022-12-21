import { EventTarget, Event } from "event-target-shim";

// Shims on top of `event-target-shim` to work with a class hierarchy.

export interface CallbackFunction<
  // @ts-ignore TypeScript thinks this is wrong - TODO look into this
  out TEventTarget extends EventTarget<any, any>,
  TEvent extends Event
> {
  (this: TEventTarget, event: TEvent): void;
}
