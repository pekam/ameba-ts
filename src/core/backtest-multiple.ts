import { flatten } from "lodash";
import { Moment } from "../shared/time-util";
import { startProgressBar } from "../util";
import {
  handleOrders,
  revertLastTransaction,
} from "./backtest-order-execution";
import { BacktestResult, convertToBacktestResult } from "./backtest-result";
import {
  Candle,
  CandleSeries,
  MarketPosition,
  Order,
  Range,
  SeriesMap,
  StrategyUpdate,
  Trade,
  Transaction,
} from "./types";

interface BacktestMultipleArgs {
  stratProvider: () => MultiAssetStrategy;
  multiSeries: SeriesMap;
  initialBalance?: number;
  showProgressBar?: boolean;
  from?: Moment;
  to?: Moment;
}

export type AssetMap = { [symbol: string]: AssetState };

export interface MultiAssetTradeState {
  cash: number;

  assets: AssetMap;
  updated: string[];

  time: number;
}

// Additional props that should not be visible to the Strategy implementor
export interface InternalTradeState extends MultiAssetTradeState {
  args: Required<BacktestMultipleArgs>;
  /**
   * The time range of candles used in the backtest so far.
   */
  range: Partial<Range>;
}

export interface AssetState {
  symbol: string;
  series: CandleSeries;

  entryOrder: Order | null;
  position: MarketPosition | null;
  takeProfit: number | null;
  stopLoss: number | null;

  transactions: Transaction[];
  trades: Trade[];
}

export type MultiAssetStrategyUpdate = (StrategyUpdate & { symbol: string })[];

export type MultiAssetStrategy = (
  state: MultiAssetTradeState
) => MultiAssetStrategyUpdate;

export function backtestMultiple(args: BacktestMultipleArgs): BacktestResult {
  const defaults = {
    initialBalance: 10000,
    showProgressBar: true,
    from: 0,
    to: Infinity,
  };
  return doBacktestMultiple({ ...defaults, ...args });
}

function doBacktestMultiple(args: Required<BacktestMultipleArgs>) {
  const strat: MultiAssetStrategy = args.stratProvider();
  let state: InternalTradeState = createInitialState(args);

  const progressBar = startProgressBar(
    getIterationCount(args),
    args.showProgressBar
  );

  // Recursion would result in heap-out-of-memory error on big candle series, as
  // JavaScript doesn't have tail call optimization.
  while (true) {
    state = addNextCandles(state);
    if (!state.updated.length) {
      // All candle series finished.
      break;
    }
    state = applyStrategy(handleAllOrders(state), strat);
    progressBar.increment();
  }
  progressBar.stop();

  // Only finished trades are included in the result. Another option would be to
  // close all open trades with the current market price, but exiting against
  // the strategy's logic would skew the result.
  return convertToBacktestResult(revertUnclosedTrades(state));
}

function createInitialState(
  args: Required<BacktestMultipleArgs>
): InternalTradeState {
  return {
    cash: args.initialBalance,
    assets: Object.entries(args.multiSeries).reduce<AssetMap>(
      (assets, [symbol, series]) => {
        const initialSeries = (() => {
          const firstCandleIndex = series.findIndex((candle) =>
            isWithinRange(args, candle)
          );
          return firstCandleIndex === -1
            ? []
            : series.slice(0, firstCandleIndex);
        })();

        assets[symbol] = {
          symbol,
          series: initialSeries,
          position: null,
          entryOrder: null,
          takeProfit: null,
          stopLoss: null,
          transactions: [],
          trades: [],
        };
        return assets;
      },
      {}
    ),
    updated: [],
    time: 0,
    args,
    range: {},
  };
}

function addNextCandles(state: InternalTradeState): InternalTradeState {
  const assets = Object.values(state.assets);

  // Collect all assets which will include a new candle
  // in the next update
  const [nextAssets, nextTime] = assets.reduce<[AssetState[], number?]>(
    ([nextAssets, minTime], asset) => {
      const candle = getNextCandle(state, asset);
      if (!candle) {
        // This asset doesn't have further candles
        return [nextAssets, minTime];
      } else if (candle.time < (minTime || Infinity)) {
        return [[asset], candle.time];
      } else if (candle.time === minTime) {
        nextAssets.push(asset); // Mutating for performance
        return [nextAssets, minTime];
      } else return [nextAssets, minTime];
    },
    [[], undefined]
  );

  // Mutating the candle arrays for performance; slice() has O(N)
  // complexity which is a real issue when backtesting big datasets.
  nextAssets.forEach((asset) => {
    asset.series.push(getNextCandle(state, asset)!);
  });

  return {
    ...state,
    updated: nextAssets.map((a) => a.symbol),
    time: nextTime || state.time,
    range: {
      from: state.range.from || nextTime,
      to: nextTime || state.range.to,
    },
  };
}

function handleAllOrders(state: InternalTradeState): InternalTradeState {
  return state.updated.reduce((state, symbol) => {
    const { asset, cash } = handleOrders({
      asset: state.assets[symbol],
      cash: state.cash,
    });
    return updateAsset(state, symbol, asset, cash);
  }, state);
}

function applyStrategy(
  state: InternalTradeState,
  strat: MultiAssetStrategy
): InternalTradeState {
  const stratUpdates = strat(state);
  const nextState: InternalTradeState = stratUpdates.reduce((state, update) => {
    if (update.entryOrder && update.entryOrder.size <= 0) {
      throw Error(
        `Order size must be positive, but was ${update.entryOrder.size}.`
      );
    }
    if (state.assets[update.symbol].position && update.entryOrder) {
      throw Error(
        "Changing entry order while already in a position is not allowed."
      );
    }
    return updateAsset(state, update.symbol, update);
  }, state);
  return nextState;
}

function revertUnclosedTrades(state: InternalTradeState) {
  return Object.values(state.assets)
    .filter((a) => a.position)
    .reduce((state, asset) => {
      const { asset: nextAssetState, cash } = revertLastTransaction({
        asset,
        cash: state.cash,
      });

      return updateAsset(state, asset.symbol, nextAssetState, cash);
    }, state);
}

/**
 * Returns a new state after applying {@link update} to the asset with
 * {@link symbol}. If the update changes also the cash balance, provide the new
 * value as {@link cash}.
 */
function updateAsset(
  state: InternalTradeState,
  symbol: string,
  update: StrategyUpdate,
  cash?: number
): InternalTradeState {
  return {
    ...state,
    cash: cash !== undefined ? cash : state.cash,
    assets: {
      ...state.assets,
      [symbol]: {
        ...state.assets[symbol],
        ...update,
      },
    },
  };
}

function getIterationCount(args: Required<BacktestMultipleArgs>) {
  return new Set(
    flatten(Object.values(args.multiSeries))
      .filter((candle) => isWithinRange(args, candle))
      .map((candle) => candle.time)
  ).size;
}

function isWithinRange(args: Required<BacktestMultipleArgs>, candle: Candle) {
  return candle.time >= args.from && candle.time <= args.to;
}

function getNextCandle(state: InternalTradeState, asset: AssetState) {
  const fullSeries = state.args.multiSeries[asset.symbol];
  const nextIndex = state.assets[asset.symbol].series.length;
  const next = fullSeries[nextIndex];
  return next && isWithinRange(state.args, next) ? next : null;
}
