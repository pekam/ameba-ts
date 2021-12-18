import { flatten, mapValues, uniqBy } from "lodash";
import { m } from "../shared/functions";
import { Moment } from "../shared/time-util";
import {
  handleOrders,
  revertLastTransaction,
} from "./backtest-order-execution";
import { BacktestResult, convertToBacktestResult } from "./backtest-result";
import { createProgressBar } from "./progress-bar";
import {
  AssetMap,
  AssetState,
  Candle,
  FullTradeState,
  FullTradingStrategy,
  Range,
  SeriesMap,
} from "./types";

interface BacktestArgs {
  /**
   * The strategy to backtest.
   */
  strategy: FullTradingStrategy;
  /**
   * The historical price data used to simulate what trades the strategy would
   * have made. The keys of this object should be the symbols identifying the
   * particular asset.
   *
   * The object can contain only one entry for trading only a single asset, or
   * many for multi-asset trading.
   */
  series: SeriesMap;
  /**
   * The initial cash balance of the account. Defaults to 10000.
   */
  initialBalance?: number;
  /**
   * A collection of callbacks that are called during backtest execution,
   * enabling reporting/visualizing the backtest's progress.
   *
   * Defaults to a handler that renders a progress bar in the console. This
   * default behavior can be disabled by explicitly passing `null` or
   * `undefined`.
   */
  progressHandler?: ProgressHandler | null;
  /**
   * If provided, the strategy will first be called with a series including all
   * the candles up to and including the first candle which has a timestamp
   * greater or equal to `from`.
   *
   * This can be useful if your strategy needs some amount of data before making
   * decisions (e.g. a strategy using a 20-period moving average needs 20
   * candles before acting), and you want the backtest result to have correct
   * values for `range` and `buyAndHoldProfit`.
   */
  from?: Moment;
  /**
   * If provided, the backtest won't include candles with timestamps greater
   * than `to`.
   */
  to?: Moment;
}

// Additional props that should not be visible to the Strategy implementor
export interface InternalTradeState extends FullTradeState {
  args: Required<BacktestArgs>;
  /**
   * The time range of candles used in the backtest so far.
   */
  range: Partial<Range>;
}

/**
 * A collection of callbacks that are called during backtest execution, enabling
 * reporting/visualizing the backtest's progress.
 */
export interface ProgressHandler {
  onStart: (iterationCount: number) => void;
  afterIteration: () => void;
  onFinish: () => void;
}

/**
 * Tests how the given trading strategy would have performed with the provided
 * historical price data.
 */
export function backtest(args: BacktestArgs): BacktestResult {
  const defaults = {
    initialBalance: 10000,
    progressHandler: createProgressBar(),
    from: 0,
    to: Infinity,
  };
  return doBacktest({ ...defaults, ...args });
}

function doBacktest(args: Required<BacktestArgs>) {
  let state: InternalTradeState = createInitialState(args);

  args.progressHandler?.onStart(getIterationCount(args));

  // Recursion would result in heap-out-of-memory error on big candle series, as
  // JavaScript doesn't have tail call optimization.
  while (true) {
    state = addNextCandles(state);
    if (!state.updated.length) {
      // All candle series finished.
      break;
    }
    state = applyStrategy(handleAllOrders(state), args.strategy);
    args.progressHandler?.afterIteration();
  }
  args.progressHandler?.onFinish();

  // Only finished trades are included in the result. Another option would be to
  // close all open trades with the current market price, but exiting against
  // the strategy's logic would skew the result.
  return convertToBacktestResult(revertUnclosedTrades(state));
}

function createInitialState(args: Required<BacktestArgs>): InternalTradeState {
  const assets: AssetMap = mapValues(args.series, (series, symbol) => {
    const initialSeries = (() => {
      const firstCandleIndex = series.findIndex(isWithinRange(args));
      return firstCandleIndex === -1 ? [] : series.slice(0, firstCandleIndex);
    })();
    return {
      symbol,
      series: initialSeries,
      position: null,
      entryOrder: null,
      takeProfit: null,
      stopLoss: null,
      transactions: [],
      trades: [],
    };
  });

  return {
    cash: args.initialBalance,
    assets,
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
  strat: FullTradingStrategy
): InternalTradeState {
  const stratUpdates = strat(state);
  const nextState: InternalTradeState = Object.entries(stratUpdates).reduce(
    (state, [symbol, update]) => {
      if (update.entryOrder && update.entryOrder.size <= 0) {
        throw Error(
          `Order size must be positive, but was ${update.entryOrder.size}.`
        );
      }
      if (
        state.assets[symbol].position &&
        m.hasOwnProperty(update, "entryOrder")
      ) {
        throw Error(
          "Changing entry order while already in a position is not allowed."
        );
      }
      return updateAsset(state, symbol, update);
    },
    state
  );
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
  update: Partial<AssetState>,
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

function getIterationCount(args: Required<BacktestArgs>): number {
  const allIncludedCandles = flatten(Object.values(args.series)).filter(
    isWithinRange(args)
  );
  return uniqBy(allIncludedCandles, (candle) => candle.time).length;
}

const isWithinRange = (args: Required<BacktestArgs>) => (candle: Candle) => {
  return candle.time >= args.from && candle.time <= args.to;
};

function getNextCandle(state: InternalTradeState, asset: AssetState) {
  const fullSeries = state.args.series[asset.symbol];
  const nextIndex = state.assets[asset.symbol].series.length;
  const next = fullSeries[nextIndex];
  return next && isWithinRange(state.args)(next) ? next : null;
}
