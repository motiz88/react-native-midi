import {
  EventTarget,
  Event,
  getEventAttributeValue as getEventAttributeValueImpl,
  setEventAttributeValue as setEventAttributeValueImpl,
} from "event-target-shim";

import { CallbackFunction } from "./event-target-shim-shim";

type EventType = string;
type EventCallback = EventTarget.EventListener<any, any>;

// An implementation of EventTarget which notifies subclasses about listeners
// being added/removed.
// May not be fully spec-compliant! TODO fix this.
export class SimpleEventTargetImpl {
  // TODO: Find a type-safe EventTarget implementation that plays nicely with
  // inheritance and interfaces.
  // For now, the MIDIPortImpl classes will be unsafe (but implement safe interfaces).
  #dispatcher: EventTarget<any> = new EventTarget();

  readonly #listeners: Map<EventType, Map<EventCallback, Set<boolean>>> =
    new Map();

  /**
   * Get the current value of a given event attribute.
   * @param type The event type.
   */
  protected getEventAttributeValue<TEvent extends Event>(
    type: string
  ): CallbackFunction<this, TEvent> | null {
    return getEventAttributeValueImpl(this.#dispatcher, type);
  }

  /**
   * Set an event listener to a given event attribute.
   * @param type The event type.
   * @param callback The event listener.
   */
  protected setEventAttributeValue(
    type: string,
    callback: CallbackFunction<any, any> | null
  ): void {
    setEventAttributeValueImpl(this.#dispatcher, type, callback);
    const hadListeners = this.hasListeners(type);
    if (
      typeof callback === "function" ||
      (typeof callback === "object" && callback !== null)
    ) {
      this.#listeners.set(type, new Map([[callback, new Set([false])]]));
      this.onAddedListener(type);
      if (!hadListeners) {
        this.onAddedFirstListener(type);
      }
    } else {
      this.#listeners.delete(type);
      if (hadListeners) {
        this.onRemovedListener(type);
        this.onRemovedLastListener(type);
      }
    }
  }

  protected onAddedListener(type: string) {}

  addEventListener(type0: EventType, callback0?: any, options0?: any): void {
    this.#dispatcher.addEventListener(type0, callback0, options0);
    const { callback, capture, signal, type } = normalizeAddOptions(
      type0,
      callback0,
      options0
    );
    if (callback == null || signal?.aborted) {
      return;
    }

    const hadListeners = this.hasListeners(type);

    let callbackMap = this.#listeners.get(type);
    if (!callbackMap) {
      callbackMap = new Map();
      this.#listeners.set(type, callbackMap);
    }
    let captureSet = callbackMap.get(callback);
    if (!captureSet) {
      captureSet = new Set();
      callbackMap.set(callback, captureSet);
    }
    if (!captureSet.has(capture)) {
      captureSet.add(capture);
      this.onAddedListener(type);
    }
    if (!hadListeners && this.hasListeners(type)) {
      this.onAddedFirstListener(type);
    }
  }

  private hasListeners(type: EventType): boolean {
    return this.#listeners.has(type);
  }

  protected onAddedFirstListener(_type: EventType) {}

  protected onRemovedLastListener(_type: EventType) {}

  dispatchEvent(event: Event): boolean {
    return this.#dispatcher.dispatchEvent(event);
  }

  removeEventListener(type0: EventType, callback0?: any, options0?: any): void {
    this.#dispatcher.removeEventListener(type0, callback0, options0);

    const { callback, capture, type } = normalizeOptions(
      type0,
      callback0,
      options0
    );
    const hadListeners = this.hasListeners(type);
    let didDelete = false;

    const callbackMap = this.#listeners.get(type);
    if (callback) {
      if (callbackMap) {
        const captureSet = callbackMap.get(callback);
        if (captureSet) {
          captureSet.delete(capture);
          didDelete = true;
          if (captureSet.size === 0) {
            callbackMap.delete(callback);
            if (callbackMap.size === 0) {
              this.#listeners.delete(type);
            }
          }
        }
      }
    }

    if (didDelete) {
      this.onRemovedListener(type);
    }

    if (hadListeners && !this.hasListeners(type)) {
      this.onRemovedLastListener(type);
    }
  }

  protected onRemovedListener(_type: string) {}
}

function normalizeAddOptions(
  type: string,
  callback: EventTarget.EventListener<any, any> | null | undefined,
  options: boolean | EventTarget.AddOptions | undefined
): {
  type: string;
  callback: EventTarget.EventListener<any, any> | undefined;
  capture: boolean;
  passive: boolean;
  once: boolean;
  signal: EventTarget.AbortSignal | undefined;
} {
  if (typeof options === "object" && options !== null) {
    return {
      type: String(type),
      callback: callback ?? undefined,
      capture: Boolean(options.capture),
      passive: Boolean(options.passive),
      once: Boolean(options.once),
      signal: options.signal ?? undefined,
    };
  }

  return {
    type: String(type),
    callback: callback ?? undefined,
    capture: Boolean(options),
    passive: false,
    once: false,
    signal: undefined,
  };
}

function normalizeOptions(
  type: string,
  callback: EventTarget.EventListener<any, any> | null | undefined,
  options: boolean | EventTarget.Options | undefined
): {
  type: string;
  callback: EventTarget.EventListener<any, any> | undefined;
  capture: boolean;
} {
  if (typeof options === "object" && options !== null) {
    return {
      type: String(type),
      callback: callback ?? undefined,
      capture: Boolean(options.capture),
    };
  }

  return {
    type: String(type),
    callback: callback ?? undefined,
    capture: Boolean(options),
  };
}
