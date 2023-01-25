import { createPipe, filter, identity, map, mapToObj, pipe } from "remeda";
import { Dictionary, Nullable } from "../util/type-util";
import { hasOwnProperty } from "../util/util";
import { BacktestState, updateAsset } from "./backtest";
import { handleOrders } from "./backtest-order-execution";
import { CandleUpdate } from "./create-candle-updates";
import {
  AssetMap,
  AssetState,
  Candle,
  FullTradingStrategy,
  SingleAssetStrategyUpdate,
} from "./types";

export function produceNextState(
  state: BacktestState,
  candleUpdate: Nullable<CandleUpdate>
): BacktestState {
  if (!candleUpdate || candleUpdate.time > state.to) {
    return pipe(
      state,
      (state) => ({ ...state, finished: true, finishTime: state.time }),
      notifyProgressHandler
    );
  }
  return pipe(
    state,
    initMissingAssetStates(candleUpdate),
    updateCandlesAndTime(candleUpdate),

    candleUpdate.time < state.from
      ? identity
      : createPipe(
          handleAllOrders,
          applyStrategy(state.strategy),
          updateFirstAndLastCandles(candleUpdate),
          notifyProgressHandler
        )
  );
}

const initMissingAssetStates =
  (candleUpdate: CandleUpdate) =>
  (state: BacktestState): BacktestState => {
    const symbols = candleUpdate.nextCandles.map(({ symbol }) => symbol);
    const newAssets: AssetMap = pipe(
      symbols,
      filter((symbol) => !state.assets[symbol]),
      mapToObj((symbol) => [
        symbol,
        {
          symbol,
          series: [],
          position: null,
          entryOrder: null,
          takeProfit: null,
          stopLoss: null,
          transactions: [],
          trades: [],
          data: {},
          bufferSize: state.bufferSize,
        },
      ])
    );
    return {
      ...state,
      assets: { ...state.assets, ...newAssets },
    };
  };

const updateCandlesAndTime =
  ({ time, nextCandles }: CandleUpdate) =>
  (state: BacktestState): BacktestState => {
    const symbols = map(nextCandles, ({ symbol }) => symbol);
    // Mutating the candle arrays for performance. Copying an array has O(N)
    // complexity which is a real issue when backtesting big datasets.
    nextCandles.forEach(({ symbol, candle }) => {
      const series = state.assets[symbol].series;
      series.push(candle);
      while (series.length > state.bufferSize) {
        series.shift();
      }
    });
    return {
      ...state,
      updated: symbols,
      time,
    };
  };

function handleAllOrders(state: BacktestState): BacktestState {
  return state.updated.reduce((state, symbol) => {
    const { asset, cash } = handleOrders({
      asset: state.assets[symbol],
      cash: state.cash,
      commissionProvider: state.commissionProvider,
    });
    return updateAsset(state, symbol, asset, cash);
  }, state);
}

const applyStrategy =
  (strat: FullTradingStrategy) =>
  (state: BacktestState): BacktestState => {
    const stratUpdates = strat(state);
    const nextState: BacktestState = Object.entries(stratUpdates).reduce(
      (state, [symbol, update]) => {
        assertUpdate(update, state.assets[symbol]);
        return updateAsset(state, symbol, update);
      },
      state
    );
    return nextState;
  };

function assertUpdate(update: SingleAssetStrategyUpdate, asset: AssetState) {
  if (update.entryOrder && update.entryOrder.size <= 0) {
    throw Error(
      `Order size must be positive, but was ${update.entryOrder.size}.`
    );
  }
  if (asset.position && hasOwnProperty(update, "entryOrder")) {
    throw Error(
      "Changing entry order while already in a position is not allowed."
    );
  }
}

const updateFirstAndLastCandles =
  (candleUpdate: CandleUpdate) =>
  (state: BacktestState): BacktestState => {
    const updatedEntries: Dictionary<[Candle, Candle]> = pipe(
      candleUpdate.nextCandles,
      mapToObj(({ symbol, candle }) => {
        const firstAndLastCandles = state.firstAndLastCandles[symbol];
        return [
          symbol,
          [firstAndLastCandles ? firstAndLastCandles[0] : candle, candle],
        ];
      })
    );
    return {
      ...state,
      firstAndLastCandles: {
        ...state.firstAndLastCandles,
        ...updatedEntries,
      },
    };
  };

function notifyProgressHandler(state: BacktestState): BacktestState {
  if (state.progressHandler) {
    state.progressHandler({
      currentTime: state.time,
      startTime: state.from,
      finishTime: state.finished ? state.time : state.to,
    });
  }
  return state;
}
