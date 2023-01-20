import { filter, map, mapToObj, pipe } from "remeda";
import { hasOwnProperty } from "../util/util";
import { InternalTradeState, updateAsset } from "./backtest";
import { handleOrders } from "./backtest-order-execution";
import { CandleUpdate } from "./create-candle-updates";
import {
  AssetMap,
  AssetState,
  FullTradingStrategy,
  SingleAssetStrategyUpdate,
} from "./types";

export function produceNextState(
  state: InternalTradeState,
  candleUpdate: CandleUpdate
) {
  return pipe(
    state,
    initMissingAssetStates(candleUpdate),
    addNextCandles(candleUpdate),
    handleAllOrders,
    applyStrategy(state.args.strategy)
  );
}

const initMissingAssetStates =
  (candleUpdate: CandleUpdate) =>
  (state: InternalTradeState): InternalTradeState => {
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
        },
      ])
    );
    return {
      ...state,
      assets: { ...state.assets, ...newAssets },
    };
  };

const addNextCandles =
  ({ time, nextCandles }: CandleUpdate) =>
  (state: InternalTradeState): InternalTradeState => {
    const symbols = map(nextCandles, ({ symbol }) => symbol);
    return pipe(state, (state) => {
      // Mutating the candle arrays for performance. Copying an array has O(N)
      // complexity which is a real issue when backtesting big datasets.
      nextCandles.forEach(({ symbol, candle }) =>
        state.assets[symbol].series.push(candle)
      );
      return {
        ...state,
        updated: symbols,
        time,
      };
    });
  };

function handleAllOrders(state: InternalTradeState): InternalTradeState {
  return state.updated.reduce((state, symbol) => {
    const { asset, cash } = handleOrders({
      asset: state.assets[symbol],
      cash: state.cash,
      commissionProvider: state.args.commissionProvider,
    });
    return updateAsset(state, symbol, asset, cash);
  }, state);
}

const applyStrategy =
  (strat: FullTradingStrategy) =>
  (state: InternalTradeState): InternalTradeState => {
    if (state.time < state.args.from) {
      return state;
    }
    const stratUpdates = strat(state);
    const nextState: InternalTradeState = Object.entries(stratUpdates).reduce(
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
