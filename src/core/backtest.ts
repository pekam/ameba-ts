import { CommissionProvider } from "..";
import { Moment, toTimestamp } from "../util/time-util";
import { Nullable, OverrideProps } from "../util/type-util";
import { produceNextState } from "./backtest-produce-next-state";
import { BacktestResult, convertToBacktestResult } from "./backtest-result";
import { CandleUpdate, createCandleUpdates } from "./create-candle-updates";
import { createProgressBar } from "./progress-bar";
import {
  AssetState,
  FullTradeState,
  FullTradingStrategy,
  Range,
  SeriesMap,
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

/**
 * Args used by both synchronous and asynchronous backtest
 */
export type CommonBacktestArgs = Omit<BacktestArgs, "series">;

export type LazyCandleProvider = (
  lastCandleTime: number | undefined
) => Promise<Nullable<CandleUpdate>>;

export type EagerCandleProvider = (
  lastCandleTime: number | undefined
) => Nullable<CandleUpdate>;

export interface BacktestLazyArgs extends CommonBacktestArgs {
  /**
   * A function that should return the next set of candles for the backtester
   * each time when called. All candles which have the same timestamp (one per
   * asset) should be included in the same return value. Each return value
   * should include newer candles than the previous one.
   *
   * The function should return null or undefined when the backtest should
   * finish. The backtest can also end if the optional 'to'-parameter is
   * provided and this moment is reached.
   *
   * The return value is a Promise, so the implementation can for example fetch
   * a batch of data from a web service or a database when needed, and there's
   * no need to keep old data in memory.
   */
  candleProvider: LazyCandleProvider;
}

function isBacktestArgs(a: BacktestArgs | BacktestLazyArgs): a is BacktestArgs {
  return !!(a as BacktestArgs).series;
}

type AdjustedBacktestArgs = OverrideProps<
  Required<CommonBacktestArgs>,
  { from: number; to: number }
>;

// Additional props that should not be visible to the Strategy implementor
export interface InternalTradeState extends FullTradeState {
  args: AdjustedBacktestArgs;
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
export function backtest(args: BacktestArgs): BacktestResult;
export function backtest(args: BacktestLazyArgs): Promise<BacktestResult>;
export function backtest(
  args: BacktestArgs | BacktestLazyArgs
): BacktestResult | Promise<BacktestResult> {
  const eager = isBacktestArgs(args);

  const state: InternalTradeState = initState(adjustArgs(args));

  // todo fix range
  const range: Range = {
    from: state.args.from || 0,
    to: state.args.to || 0,
  };

  // todo use progress handler again

  if (eager) {
    const candleUpdates = createCandleUpdates(args.series);
    // todo optimize
    const candleProvider: EagerCandleProvider = (
      lastCandleTime: number | undefined
    ) => candleUpdates.find((c) => c.time > (lastCandleTime || -Infinity));

    return convertToBacktestResult(
      produceFinalState(state, candleProvider),
      range
    );
  } else {
    return produceFinalStateLazy(state, args.candleProvider).then(
      (finalState) => convertToBacktestResult(finalState, range)
    );
  }
}

export function adjustArgs(
  args: CommonBacktestArgs
): OverrideProps<Required<CommonBacktestArgs>, { from: number; to: number }> {
  const withDefaults: Required<CommonBacktestArgs> = {
    initialBalance: 10000,
    commissionProvider: () => 0,
    from: 0,
    to: Infinity,
    progressHandler: createProgressBar(),
    ...args,
  };
  return {
    ...withDefaults,
    // Enforce timestamps as numbers:
    from: toTimestamp(withDefaults.from),
    to: toTimestamp(withDefaults.to),
  };
}

function produceFinalState(
  state: InternalTradeState,
  candleProvider: EagerCandleProvider
): InternalTradeState {
  while (true) {
    const candleUpdate = candleProvider(state.time || undefined);
    if (!candleUpdate || candleUpdate.time > state.args.to) {
      return state;
    }
    state = produceNextState(state, candleUpdate);
  }
}

async function produceFinalStateLazy(
  state: InternalTradeState,
  candleProvider: LazyCandleProvider
): Promise<InternalTradeState> {
  while (true) {
    const candleUpdate = await candleProvider(state.time || undefined);
    if (!candleUpdate || candleUpdate.time > state.args.to) {
      return state;
    }
    state = produceNextState(state, candleUpdate);
  }
}

function initState(args: InternalTradeState["args"]): InternalTradeState {
  return {
    cash: args.initialBalance,
    assets: {},
    updated: [],
    time: 0,
    args,
  };
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
