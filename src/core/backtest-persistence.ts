import { DateTime } from "luxon";
import { identity, mapValues, omit, pipe } from "remeda";
import { indicatorDataKey } from "../indicators/indicator";
import { Persister, PersisterKey } from "../persistence";
import { BacktestAsyncArgs, BacktestState } from "./backtest";

/**
 * Sets up persistence state.
 *
 * If a previously persisted state matching the key is found, loads and applies
 * to state.
 */
export const initBacktestPersistence =
  (persistenceArgs: BacktestAsyncArgs["persistence"]) =>
  async (initialState: BacktestState): Promise<BacktestState> => {
    if (!persistenceArgs) {
      return initialState;
    }

    const { persister, interval } = persistenceArgs;

    const key: PersisterKey = {
      category: "backtest",
      // NOTE: technically possible to have duplicate keys if starting multiple
      // backtests on the same millisecond
      key: persistenceArgs.key || DateTime.utc().toISO(),
    };

    const persistedState = await persister.get(key);

    const persistenceState: BacktestPersistenceState = {
      persister,
      interval,
      key,
      updatesSincePersist: 0,
    };

    return pipe(
      initialState,
      persistedState != null
        ? (state) => ({ ...state, ...persistedState })
        : identity,
      (state) => ({
        ...state,
        persistence: persistenceState,
      })
    );
  };

export interface BacktestPersistenceState {
  persister: Persister;
  interval: number;
  key: PersisterKey;
  updatesSincePersist: number;
}

export function persistIfNeeded(state: BacktestState): BacktestState {
  if (!state.persistence) {
    return state;
  }

  const nextCounter = persistIfNeededAndGetNextCounter(
    state,
    state.persistence
  );

  return {
    ...state,
    persistence: { ...state.persistence, updatesSincePersist: nextCounter },
  };
}

function persistIfNeededAndGetNextCounter(
  state: BacktestState,
  persistence: BacktestPersistenceState
) {
  const {
    persister,
    interval: persistInterval,
    key,
    updatesSincePersist,
  } = persistence;
  if (updatesSincePersist >= persistInterval) {
    // NOTE: does not wait for it to finish if async
    persister.set(key, convertToPersistence(state));
    return 0;
  } else {
    return updatesSincePersist + 1;
  }
}

type PersistedInternalTradeState = Omit<
  BacktestState,
  "strategy" | "commissionProvider" | "progressHandler" | "persistence"
>;

function convertToPersistence(
  state: BacktestState
): PersistedInternalTradeState {
  return pipe(
    state,
    clearIndicators,
    // Functions are not serializable, and backtest should be called with the
    // same args when resuming, so these should become equal.
    omit(["strategy", "commissionProvider", "progressHandler", "persistence"])
  );
}

/**
 * Indicators are stored as functions (not serializable), and they should not
 * change when re-computed if resuming a backtest.
 */
function clearIndicators(state: BacktestState): BacktestState {
  return {
    ...state,
    assets: mapValues(state.assets, (a) => ({
      ...a,
      data: { ...a.data, [indicatorDataKey]: undefined },
    })),
  };
}
