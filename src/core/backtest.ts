import { mapValues } from "lodash";
import { first, last, map, pipe } from "remeda";
import { CommissionProvider } from "..";
import { Moment, toTimestamp } from "../util/time-util";
import { OverrideProps } from "../util/type-util";
import { hasOwnProperty } from "../util/util";
import { handleOrders } from "./backtest-order-execution";
import { BacktestResult, convertToBacktestResult } from "./backtest-result";
import { CandleUpdate, createCandleUpdates } from "./create-candle-updates";
import { createProgressBar } from "./progress-bar";
import {
  AssetMap,
  AssetState,
  Candle,
  FullTradeState,
  FullTradingStrategy,
  SeriesMap,
  SingleAssetStrategyUpdate,
} from "./types";

export interface BacktestArgs {
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
   * A function that returns commissions (transaction costs) for transactions,
   * enabling simulation of trading fees charged by a real broker. Refer to
   * {@link CommissionProvider} docs for examples.
   */
  commissionProvider?: CommissionProvider;
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

type AdjustedBacktestArgs = OverrideProps<
  Required<BacktestArgs>,
  { from: number; to: number }
>;

// Additional props that should not be visible to the Strategy implementor
export interface InternalTradeState extends FullTradeState {
  args: Pick<
    AdjustedBacktestArgs,
    "initialBalance" | "strategy" | "commissionProvider"
  >;
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
  return doBacktest(adjustArgs(args));
}

export function adjustArgs(args: BacktestArgs): AdjustedBacktestArgs {
  const withDefaults = {
    initialBalance: 10000,
    commissionProvider: () => 0,
    progressHandler: createProgressBar(),
    from: 0,
    to: Infinity,
    ...args,
  };
  return {
    ...withDefaults,
    // Enforce timestamps as numbers:
    from: toTimestamp(withDefaults.from),
    to: toTimestamp(withDefaults.to),
  };
}

function doBacktest(args: AdjustedBacktestArgs) {
  const candleUpdates = createCandleUpdates(args.series, isWithinRange(args));
  if (!candleUpdates.length) {
    throw Error("There are no candles to backtest with.");
  }

  args.progressHandler?.onStart(candleUpdates.length);

  const finalState = candleUpdates.reduce((state, candleUpdate) => {
    const nextState = produceNextState(state, candleUpdate);
    args.progressHandler?.afterIteration();
    return nextState;
  }, initState(args, initAssets(args)));

  args.progressHandler?.onFinish();

  return convertToBacktestResult(finalState, {
    from: first(candleUpdates)!.time, // candleUpdates.length asserted earlier
    to: last(candleUpdates)!.time,
  });
}

export function produceNextState(
  state: InternalTradeState,
  candleUpdate: CandleUpdate
) {
  return pipe(
    state,
    addNextCandles(candleUpdate),
    handleAllOrders,
    applyStrategy(state.args.strategy)
  );
}

export function initState(
  args: InternalTradeState["args"],
  assets: AssetMap
): InternalTradeState {
  return {
    cash: args.initialBalance,
    assets,
    updated: [],
    time: 0,
    args,
  };
}

function initAssets(args: AdjustedBacktestArgs): AssetMap {
  return mapValues(args.series, (series, symbol) => {
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
      data: {},
    };
  });
}

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

/**
 * Returns a new state after applying {@link update} to the asset with
 * {@link symbol}. If the update changes also the cash balance, provide the new
 * value as {@link cash}.
 */
export function updateAsset(
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

const isWithinRange = (args: AdjustedBacktestArgs) => (candle: Candle) => {
  return candle.time >= args.from && candle.time <= args.to;
};
