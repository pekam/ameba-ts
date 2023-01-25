import { findLast } from "lodash";
import { pipe } from "remeda";
import { CommissionProvider, Persister } from "..";
import { Moment, toTimestamp } from "../time";
import { Dictionary, Nullable, OverrideProps } from "../util/type-util";
import { repeatUntil, repeatUntilAsync, then } from "../util/util";
import {
  BacktestPersistenceState,
  initBacktestPersistence,
} from "./backtest-persistence";
import { produceNextState } from "./backtest-produce-next-state";
import { BacktestResult, convertToBacktestResult } from "./backtest-result";
import { CandleUpdate, createCandleUpdates } from "./create-candle-updates";
import { createProgressBar, ProgressHandler } from "./progress-handler";
import {
  AssetState,
  Candle,
  FullTradeState,
  FullTradingStrategy,
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
   * A callback that is called during backtest execution, enabling
   * reporting/visualizing the backtest's progress.
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
  /**
   * The number of candles and indicators to keep in memory during the backtest.
   * When bufferSize is reached, the oldest candles and indicators will be
   * removed as new ones are added. Defaults to 10000.
   */
  bufferSize?: number;
}

/**
 * Args used by both synchronous and asynchronous backtest
 */
export type CommonBacktestArgs = Omit<BacktestArgs, "series">;

export interface AsyncBacktestArgs extends CommonBacktestArgs {
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
  candleProvider: AsyncCandleUpdateProvider;
  /**
   * If defined, the backtest state will be persisted periodically, allowing to
   * resume the backtest later. This can be useful when backtesting with big
   * data sets fetched on demand from an external API, when an error in the API
   * call could otherwise cause a need to restart the entire backtest.
   *
   * If persistence.key matches a previously persisted backtest state, the
   * matching state is loaded to resume that backtest run. In this case, you
   * should make sure to pass the same arguments to backtest as previously.
   */
  persistence?: {
    /**
     * The persister used to store the backtest state periodically.
     */
    persister: Persister;
    /**
     * The number of updates to run between each persisting.
     */
    interval: number;
    /**
     * Identifier for this backtest run, used with the persister. If it's an
     * existing key matching a previously started backtest, the backtest state
     * is loaded from the persister and used to resume the backtest run.
     *
     * If not provided, the backtest's start time as ISO date string is used as
     * the key.
     */
    key?: string;
  };
}

export type AsyncCandleUpdateProvider = (
  lastCandleTime: number | undefined
) => Promise<Nullable<CandleUpdate>>;

export type CandleUpdateProvider = (
  lastCandleTime: number | undefined
) => Nullable<CandleUpdate>;

function isSynchronous(a: BacktestArgs | AsyncBacktestArgs): a is BacktestArgs {
  return !!(a as BacktestArgs).series;
}

type AdjustedBacktestArgs = OverrideProps<
  Required<CommonBacktestArgs>,
  { from: number; to: number }
> &
  Pick<AsyncBacktestArgs, "persistence">;

// Additional props that should not be visible to the Strategy implementor
export interface InternalTradeState extends FullTradeState {
  args: AdjustedBacktestArgs;
  finished: boolean;
  /**
   * Timestamp of the first included candle if known.
   */
  startTime?: number;
  /**
   * Timestamp of the last included candle if known, or an estimate of it.
   */
  finishTime?: number;
  firstAndLastCandles: Dictionary<[Candle, Candle]>;
  persistence?: BacktestPersistenceState;
}

/**
 * Tests how the given trading strategy would have performed with the provided
 * historical price data.
 */
export function backtest(args: BacktestArgs): BacktestResult;
export function backtest(args: AsyncBacktestArgs): Promise<BacktestResult>;
export function backtest(
  originalArgs: BacktestArgs | AsyncBacktestArgs
): BacktestResult | Promise<BacktestResult> {
  const state: InternalTradeState = initState(adjustArgs(originalArgs));

  if (isSynchronous(originalArgs)) {
    const candleUpdates = createCandleUpdates(originalArgs.series);
    const candleProvider = toCandleProvider(candleUpdates);
    return pipe(
      state,
      addFinishTimeFromCandleUpdates(candleUpdates),
      produceFinalState(candleProvider),
      convertToBacktestResult
    );
  } else {
    return pipe(
      state,
      addFinishTime(originalArgs.to),
      initBacktestPersistence,
      then(produceFinalStateAsync(originalArgs.candleProvider)),
      then(convertToBacktestResult)
    );
  }
}

const produceFinalState = (candleProvider: CandleUpdateProvider) =>
  repeatUntil(
    (state: InternalTradeState) =>
      produceNextState(state, candleProvider(state.time || undefined)),
    (state: InternalTradeState) => state.finished
  );

const produceFinalStateAsync = (candleProvider: AsyncCandleUpdateProvider) =>
  repeatUntilAsync(
    async (state: InternalTradeState) =>
      produceNextState(state, await candleProvider(state.time || undefined)),
    (state: InternalTradeState) => state.finished
  );

function adjustArgs(args: CommonBacktestArgs): AdjustedBacktestArgs {
  const withDefaults: Required<CommonBacktestArgs> = {
    initialBalance: 10000,
    commissionProvider: () => 0,
    from: 0,
    to: Infinity,
    progressHandler: createProgressBar(),
    bufferSize: 10000,
    ...args,
  };
  return {
    ...withDefaults,
    // Enforce timestamps as numbers:
    from: toTimestamp(withDefaults.from),
    to: toTimestamp(withDefaults.to),
  };
}

function initState(args: InternalTradeState["args"]): InternalTradeState {
  return {
    cash: args.initialBalance,
    assets: {},
    updated: [],
    time: 0,
    args,
    finished: false,
    firstAndLastCandles: {},
  };
}

const addFinishTimeFromCandleUpdates =
  (candleUpdates: CandleUpdate[]) =>
  (state: InternalTradeState): InternalTradeState =>
    addFinishTime(
      findLast(
        candleUpdates,
        (candleUpdate) => !state.args.to || candleUpdate.time <= state.args.to
      )?.time
    )(state);

const addFinishTime =
  (finishTime: Moment | undefined) =>
  (state: InternalTradeState): InternalTradeState => ({
    ...state,
    finishTime: finishTime === undefined ? finishTime : toTimestamp(finishTime),
  });

function toCandleProvider(candleUpdates: CandleUpdate[]): CandleUpdateProvider {
  // Stateful for performance. The correctness of this helper value is still
  // verified each time, so the function works correctly even if it gets out of
  // sync with the backtest process (for example, if the bactest execution is
  // resumed by using a persisted backtest state).
  let candleIndex = 0;

  return (lastCandleTime: number | undefined) => {
    if (!lastCandleTime) {
      candleIndex = 0;
    } else {
      const isCorrect = candleUpdates[candleIndex - 1]?.time === lastCandleTime;
      if (!isCorrect) {
        candleIndex = candleUpdates.findIndex(
          (update) => update.time > lastCandleTime
        );
      }
    }
    return candleUpdates[candleIndex++];
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
