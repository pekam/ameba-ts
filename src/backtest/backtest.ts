import { first, last, pipe } from "remeda";
import { CandleDataProvider, Persister } from "..";
import {
  Candle,
  FullTradeState,
  FullTradingStrategy,
  SeriesMap,
  Transaction,
} from "../core/types";
import { Moment, Timeframe, toTimestamp } from "../time";
import { Dictionary } from "../util/type-util";
import { repeatUntil, repeatUntilAsync, tap, then } from "../util/util";
import {
  BacktestPersistenceState,
  initBacktestPersistence,
  persistBacktestResultIfNeeded,
  persistIfNeeded,
} from "./backtest-persistence";
import {
  BacktestResult,
  BacktestSyncResult,
  convertToBacktestResult,
  convertToBacktestSyncResult,
} from "./backtest-result";
import {
  AsyncCandleUpdateProvider,
  createAsyncCandleProvider,
} from "./candle-update-provider-async";
import {
  SyncCandleUpdateProvider,
  createSyncCandleProvider,
} from "./candle-update-provider-sync";
import { createCandleUpdates } from "./create-candle-updates";
import { produceNextState } from "./produce-next-state";
import { ProgressHandler, createProgressBar } from "./progress-handler";

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
  /**
   * Enables overriding the behavior of providing the next set of candles for
   * each iteration of the backtest.
   */
  createCandleUpdateProvider?: (
    args: Omit<BacktestAsyncArgs, "createCandleUpdateProvider">
  ) => AsyncCandleUpdateProvider;
}

/**
 * Function that provides simulated commissions (transaction costs) for the
 * backtester.
 *
 * For example, if the commission is 0.1% of the transaction's cash value:
 * ```
 * const commissionProvider = (transaction: Transaction) =>
 *   transaction.size * transaction.price * 0.001
 * ```
 * Or if you want to simulate a stock broker which charges $0.005 per share, but
 * min $1 per transaction, and max 1% of the transaction's value:
 * ```
 * const commissionProvider = (transaction: Transaction) =>
 *   Math.max(
 *     Math.min(transaction.size * 0.005, 1),
 *     0.01 * transaction.size * transaction.price)
 * ```
 */
export type CommissionProvider = (
  transaction: Omit<Transaction, "commission">
) => number;

export type BacktestState = FullTradeState &
  Required<CommonBacktestArgs> & { from: number; to: number } & {
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
export async function backtest(
  args: BacktestAsyncArgs
): Promise<BacktestResult> {
  const stateOrResult = await pipe(
    args,
    initState(toTimestamp(args.from), toTimestamp(args.to)),
    initBacktestPersistence(args.persistence)
  );
  if (stateOrResult.finished) {
    // Backtest with this persistence key is already finished
    return stateOrResult.result;
  }
  return pipe(
    stateOrResult.state,
    produceFinalStateAsync(createAsyncCandleProvider(args)),
    then((state) =>
      pipe(
        state,
        convertToBacktestResult(args),
        tap(persistBacktestResultIfNeeded(state))
      )
    )
  );
}

/**
 * Tests how the given trading strategy would have performed with the provided
 * historical price data.
 *
 * To backtest asynchronously with lazy loaded price data, you can use
 * {@link backtest} instead.
 */
export function backtestSync(args: BacktestSyncArgs): BacktestSyncResult {
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
  return pipe(
    args,
    initState(from, to),
    produceFinalStateSync(createSyncCandleProvider(candleUpdates)),
    convertToBacktestSyncResult
  );
}

const produceFinalStateAsync = (candleProvider: AsyncCandleUpdateProvider) =>
  repeatUntilAsync(
    (state: BacktestState) =>
      pipe(
        candleProvider(state.time || undefined),
        then((candleUpdate) => produceNextState(state, candleUpdate)),
        then(persistIfNeeded)
      ),
    (state: BacktestState) => state.finished
  );

const produceFinalStateSync = (candleProvider: SyncCandleUpdateProvider) =>
  repeatUntil(
    (state: BacktestState) =>
      produceNextState(state, candleProvider(state.time || undefined)),
    (state: BacktestState) => state.finished
  );

const initState =
  (from: number, to: number) =>
  (args: CommonBacktestArgs): BacktestState => {
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
  };
