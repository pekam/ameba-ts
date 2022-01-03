import { AssetState } from "./types";

export interface StatefulAsset extends AssetState {
  _stateHook: ReturnType<typeof createStateHook>;
}

export function createStateHook() {
  const hookValues: any[] = [];

  let cursor = 0;

  function useState<T>(initialValue: T): [T, (value: T) => void] {
    // This is the same "magic" as in React hooks. By assuming that the user
    // makes the same amount of useState calls in the same order in each
    // strategy function call, we can map them to correct values in an array.
    // The framework's responsibility is to reset the cursor value to 0 between
    // strategy calls.
    const hookIndex = cursor++;
    if (!hookValues[hookIndex]) {
      hookValues[hookIndex] = initialValue;
    }
    return [hookValues[hookIndex], (value) => (hookValues[hookIndex] = value)];
  }

  function reset() {
    cursor = 0;
  }

  return {
    useState,
    /**
     * Needs to be called by the strategy runner (bactester or broker
     * integration) between the strategy function calls.
     */
    reset,
  };
}

export function useState<T>(asset: AssetState, initialValue: T) {
  const stateHandler = (asset as StatefulAsset)._stateHook;

  if (!stateHandler) {
    throw Error("The strategy runner does not support useState.");
  }

  return stateHandler.useState(initialValue);
}
