import { DateTime } from "luxon";
import { identity, mapValues, omit, pipe } from "remeda";
import { indicatorDataKey } from "../indicators/indicator";
import { Persister, PersisterKey } from "../persistence";
import { Nullable } from "../util/type-util";
import { BacktestAsyncArgs, BacktestState } from "./backtest";
import { BacktestResult } from "./backtest-result";

/**
 * Persisted entry for a backtest run. If the backtest is in progress, it
 * includes required parts of the state to resume the progress. If the backtest
 * is finished, it includes the backtest result.
 */
type PersistedBacktest =
  | {
      finished: false;
      state: Omit<
        BacktestState,
        "strategy" | "commissionProvider" | "progressHandler" | "persistence"
      >;
    }
  | {
      finished: true;
      result: BacktestResult;
    };

/**
 * If a backtest with the provided key has been run to completion and stored
 * with the given persister, returns the result of that backtest.
 */
export async function getPersistedBacktestResult(
  persister: Persister,
  key: string
): Promise<BacktestResult | undefined> {
  const entry = await persister.get<PersistedBacktest>(toPersisterKey(key));
  if (entry && entry.finished) {
    return entry.result;
  }
  return undefined;
}

function toPersisterKey(key: string): PersisterKey {
  return { category: "backtest", key };
}

/**
 * Sets up persistence state.
 *
 * If a previously persisted state matching the key is found, loads and applies
 * to state.
 *
 * If a backtest with the provided key has already finished and the persisted
 * backtest result is returned.
 */
export const initBacktestPersistence =
  (persistenceArgs: BacktestAsyncArgs["persistence"]) =>
  async (
    initialState: BacktestState
  ): Promise<
    | { finished: false; state: BacktestState }
    | { finished: true; result: BacktestResult }
  > => {
    if (!persistenceArgs) {
      return { finished: false, state: initialState };
    }

    const { persister, interval } = persistenceArgs;

    // NOTE: technically possible to have duplicate keys if starting multiple
    // backtests on the same millisecond
    const key: PersisterKey = toPersisterKey(
      persistenceArgs.key || DateTime.utc().toISO()!
    );

    const persistedBacktest: Nullable<PersistedBacktest> = await persister.get(
      key
    );

    if (persistedBacktest?.finished) {
      return persistedBacktest;
    }

    const persistenceState: BacktestPersistenceState = {
      persister,
      interval,
      key,
      updatesSincePersist: 0,
    };

    return pipe(
      initialState,
      persistedBacktest
        ? (state) => ({ ...state, ...persistedBacktest.state })
        : identity,
      (state) => ({
        finished: false,
        state: {
          ...state,
          persistence: persistenceState,
        },
      })
    );
  };

export interface BacktestPersistenceState {
  persister: Persister;
  interval: number;
  key: PersisterKey;
  updatesSincePersist: number;
}

export async function persistIfNeeded(
  state: BacktestState
): Promise<BacktestState> {
  if (!state.persistence) {
    return state;
  }

  const nextCounter = await persistIfNeededAndGetNextCounter(
    state,
    state.persistence
  );

  return {
    ...state,
    persistence: { ...state.persistence, updatesSincePersist: nextCounter },
  };
}

async function persistIfNeededAndGetNextCounter(
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
    await persister.set(key, convertToPersistence(state));
    return 0;
  } else {
    return updatesSincePersist + 1;
  }
}

function convertToPersistence(state: BacktestState): PersistedBacktest {
  return pipe(
    state,
    clearIndicators,
    // Functions are not serializable, and backtest should be called with the
    // same args when resuming, so these should become equal.
    omit(["strategy", "commissionProvider", "progressHandler", "persistence"]),
    (state) => ({ finished: false, state })
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

export const persistBacktestResultIfNeeded =
  ({ persistence }: BacktestState) =>
  async (result: BacktestResult) => {
    if (!persistence) {
      return;
    }
    const persistedBacktest: PersistedBacktest = {
      finished: true,
      result,
    };
    const { persister, key } = persistence;
    await persister.set(key, persistedBacktest);
  };
