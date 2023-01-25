import { first, last, pipe } from "remeda";
import {
  CandleDataProvider,
  CommissionProvider,
  createAsyncCandleProvider,
  Persister,
} from "..";
import { Moment, Timeframe, toTimestamp } from "../time";
import { Dictionary, Nullable } from "../util/type-util";
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

/**
 * Args used by both synchronous and asynchronous backtest.
 */
export interface CommonBacktestArgs {
  /**
   * The strategy to backtest.
   */
  strategy: FullTradingStrategy;
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
   * The number of candles and indicators to keep in memory during the backtest.
   * When bufferSize is reached, the oldest candles and indicators will be
   * removed as new ones are added. Defaults to 10000.
   */
  bufferSize?: number;
}

export interface BacktestSyncArgs extends CommonBacktestArgs {
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

export interface BacktestAsyncArgs extends CommonBacktestArgs {
  /**
   * A function that the backtester will use to fetch candlestick price data as
   * needed. Candles are fetched in batches and the number of candles attempted
   * to fetch each time is defined by the batchSize argument (defaults to 1000).
   */
  dataProvider: CandleDataProvider;
  /**
   * Symbols of the assets to backtest with.
   */
  symbols: string[];
  /**
   * Resolution of the candlestick data (OHLCV) that is loaded from data
   * provider for the backtest.
   */
  timeframe: Timeframe;
  /**
   * The start time of the backtest. The data provider will load price data
   * starting from this moment.
   */
  from: Moment;
  /**
   * The end time of the backtest. The data provider will load price data up to
   * this moment.
   */
  to: Moment;
  /**
   * The number of candles to fetch from the data provider when more data is
   * needed. To be more precise, candles are requested for a time window which
   * is based on timeframe and batch size, and the number of candles returned
   * from that time window may be less than batch size, for example if the
   * market is closed during that time window. Defaults to 1000.
   */
  batchSize?: number;
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

/**
 * Called on each iteration of the backtester to provides the next set of
 * candles (max one per symbol, each with the same timestamp).
 */
export type SyncCandleUpdateProvider = (
  lastCandleTime: number | undefined
) => Nullable<CandleUpdate>;
/**
 * Called on each iteration of the backtester to provides the next set of
 * candles (max one per symbol, each with the same timestamp).
 */
export type AsyncCandleUpdateProvider = (
  lastCandleTime: number | undefined
) => Promise<Nullable<CandleUpdate>>;

// Additional props that should not be visible to the Strategy implementor
export type InternalTradeState = FullTradeState &
  Required<CommonBacktestArgs & { from: number; to: number }> & {
    finished: boolean;
    firstAndLastCandles: Dictionary<[Candle, Candle]>;
    persistence?: BacktestPersistenceState;
  };

/**
 * Tests how the given trading strategy would have performed with historical
 * price data fetched from the given data provider.
 *
 * To backtest synchronously with in-memory data, you can use
 * {@link backtestSync} instead.
 */
export function backtest(args: BacktestAsyncArgs): Promise<BacktestResult> {
  const state: InternalTradeState = initState(
    args,
    toTimestamp(args.from),
    toTimestamp(args.to)
  );
  const candleProvider = createAsyncCandleProvider(args);
  return pipe(
    state,
    initBacktestPersistence(args.persistence),
    then(produceFinalStateAsync(candleProvider)),
    then(convertToBacktestResult)
  );
}

/**
 * Tests how the given trading strategy would have performed with the provided
 * historical price data.
 *
 * To backtest asynchronously with lazy loaded price data, you can use
 * {@link backtest} instead.
 */
export function backtestSync(args: BacktestSyncArgs): BacktestResult {
  const candleUpdates = createCandleUpdates(args.series);
  if (!candleUpdates.length) {
    throw Error("No candles provided");
  }
  const from = Math.max(
    args.from ? toTimestamp(args.from) : -Infinity,
    first(candleUpdates)!.time
  );
  const to = Math.min(
    args.to ? toTimestamp(args.to) : Infinity,
    last(candleUpdates)!.time
  );
  const state: InternalTradeState = initState(args, from, to);
  const candleProvider = toSyncCandleProvider(candleUpdates);
  return pipe(
    state,
    produceFinalStateSync(candleProvider),
    convertToBacktestResult
  );
}

const produceFinalStateAsync = (candleProvider: AsyncCandleUpdateProvider) =>
  repeatUntilAsync(
    async (state: InternalTradeState) =>
      produceNextState(state, await candleProvider(state.time || undefined)),
    (state: InternalTradeState) => state.finished
  );

const produceFinalStateSync = (candleProvider: SyncCandleUpdateProvider) =>
  repeatUntil(
    (state: InternalTradeState) =>
      produceNextState(state, candleProvider(state.time || undefined)),
    (state: InternalTradeState) => state.finished
  );

function initState(
  args: CommonBacktestArgs,
  from: number,
  to: number
): InternalTradeState {
  const argsWithDefaults = {
    initialBalance: 10000,
    commissionProvider: () => 0,
    progressHandler: createProgressBar(),
    bufferSize: 10000,

    ...args,
  };
  return {
    ...argsWithDefaults,
    cash: argsWithDefaults.initialBalance,
    assets: {},
    updated: [],
    time: 0,
    finished: false,
    firstAndLastCandles: {},
    from,
    to,
  };
}

function toSyncCandleProvider(
  candleUpdates: CandleUpdate[]
): SyncCandleUpdateProvider {
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
