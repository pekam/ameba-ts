import { drop, first, pipe, reverse } from "remeda";
import { getMultiCandles, PERIODS, toTimestamp } from "..";
import { BacktestAsyncArgs } from "../backtest";
import {
  CandleUpdate,
  createCandleUpdates,
} from "../backtest/create-candle-updates";
import { then } from "../util/util";
import { Universe, UniverseSet } from "./get-universe-set";

export const getIntradayUniverseCandleProvider =
  (
    universeSet: UniverseSet
  ): Required<BacktestAsyncArgs>["createCandleUpdateProvider"] =>
  (args) => {
    let state: State = {
      universes: universeSet.universes,
      candleUpdates: [],
      finished: false,
    };

    return async () => {
      while (!state.candleUpdates.length && !state.finished) {
        state = await getCandleUpdatesForNextDay(state, args);
      }
      if (state.finished) {
        return undefined;
      }
      return state.candleUpdates.pop(); // array should be reversed
    };
  };

interface State {
  universes: Universe[];
  candleUpdates: CandleUpdate[];
  finished: boolean;
}

async function getCandleUpdatesForNextDay(
  state: State,
  args: BacktestAsyncArgs
): Promise<State> {
  const universe = first(state.universes);
  if (!universe) {
    return { ...state, finished: true, candleUpdates: [] };
  }
  const from = toTimestamp(universe.time);

  const candleUpdates = await pipe(
    getMultiCandles({
      symbols: universe.symbols,
      dataProvider: args.dataProvider,
      from,
      to: from + PERIODS.day,
      timeframe: args.timeframe,
    }),
    then(createCandleUpdates),
    then(reverse()) // for perf, removing from end
  );
  return {
    ...state,
    universes: drop(state.universes, 1),
    candleUpdates,
  };
}
