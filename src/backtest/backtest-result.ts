import { flatMap, max, min, sortBy, sumBy } from "lodash";
import { map, pipe, values } from "remeda";
import { Candle, Range, Trade } from "../core/types";
import { Timeframe, toTimestamp } from "../time";
import { OverrideProps } from "../util/type-util";
import { BacktestAsyncArgs, BacktestState } from "./backtest";
import { revertLastTransaction } from "./backtest-order-execution";
import { updateAsset } from "./update-asset";

export interface BacktestStatistics {
  initialBalance: number;
  endBalance: number;
  /**
   * The change of account balance relative to the initial balance.
   *
   * For example: -0.5 for a 50% loss, or 1.2 for a 120% profit.
   */
  relativeProfit: number;
  /**
   * Number of trades executed during the backtest.
   */
  tradeCount: number;
  /**
   * Number of profitable trades relative to all trades.
   *
   * For example: 0.4 if there were 4 wins and 6 losses (or breakeven trades).
   */
  successRate: number;
  /**
   * How much was the relative value change during the series. This value can be
   * used as a benchmark to compare the result to, as it shows how much you
   * would have profited by simply holding the assets for the backtest period
   * (might not be relevant if the strategy trades both long and short
   * positions).
   *
   * If multiple assets were included in the backtest, their buy-and-hold
   * profits will be averaged with weights based on the series lengths.
   */
  buyAndHoldProfit: number;
  /**
   * Timestamps of the first and last candle included in the backtest (both
   * inclusive). Not defined if the backtest didn't use any candles.
   */
  range: Range | undefined;
  /**
   * Information about the data used in the backtest. Contains everything needed
   * to load the same set of data as used by the backtest.
   */
  dataInfo: {
    /**
     * Name of the data provider that was used to fetch data for the backtest.
     */
    dataProviderName: string;
    /**
     * Symbols of the assets included in the backtest. This is based on the
     * backtest arguments, so a symbol is included here even if no candles were
     * provided for that asset in the backtest.
     */
    symbols: string[];
    /**
     * Timeframe of the data used in the backtest (from backtest arguments).
     */
    timeframe: Timeframe;
    /**
     * Backtest data was requested from the data provider starting from this
     * timestamp.
     */
    from: number;
    /**
     * Backtest data was requested from the data provider up to this timestamp.
     */
    to: number;
  };
}

export interface BacktestResult {
  /**
   * All the trades that the strategy executed during the backtest in
   * chronological order.
   */
  trades: Trade[];
  /**
   * Performance metrics and related information about the backtest.
   */
  stats: BacktestStatistics;
}

export type BacktestSyncStatistics = Omit<BacktestStatistics, "dataInfo">;

export type BacktestSyncResult = OverrideProps<
  BacktestResult,
  { stats: BacktestSyncStatistics }
>;

export const convertToBacktestResult =
  (args: BacktestAsyncArgs) =>
  (finalState: BacktestState): BacktestResult => {
    const result = convertToBacktestSyncResult(finalState);
    const stats: BacktestStatistics = {
      ...result.stats,
      dataInfo: {
        timeframe: args.timeframe,
        symbols: args.symbols,
        dataProviderName: args.dataProvider.name,
        from: toTimestamp(args.from),
        to: toTimestamp(args.to),
      },
    };
    return { ...result, stats };
  };

export const convertToBacktestSyncResult = (
  finalState: BacktestState
): BacktestSyncResult => {
  // Only finished trades are included in the result. Another option would be to
  // close all open trades with the current market price, but exiting against
  // the strategy's logic would be skew the result in a worse way.
  return pipe(finalState, revertUnclosedTrades, (finalState) => {
    const initialBalance = finalState.initialBalance;
    const trades = getTradesInOrder(finalState);

    const endBalance = finalState.cash;

    return {
      trades,
      stats: {
        initialBalance,
        endBalance,
        relativeProfit: (endBalance - initialBalance) / initialBalance,
        tradeCount: trades.length,
        successRate:
          trades.filter((t) => t.absoluteProfit > 0).length / trades.length,
        buyAndHoldProfit: getBuyAndHoldProfit(finalState),
        range: getRange(finalState),
      },
    };
  });
};

function revertUnclosedTrades(state: BacktestState) {
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

function getTradesInOrder(state: BacktestState) {
  return sortBy(
    flatMap(state.assets, (a) => a.trades),
    (t) => t.entry.time
  );
}

function getBuyAndHoldProfit(state: BacktestState): number {
  const profitsAndDurations: [number, number][] = pipe(
    state.firstAndLastCandles,
    values,
    map(getBuyAndHoldProfitAndDuration)
  );

  const totalWeight = sumBy(
    profitsAndDurations,
    ([profit, duration]) => duration
  );

  const weightedAvg = sumBy(
    profitsAndDurations,
    ([profit, duration]) => (profit * duration) / totalWeight
  );

  return weightedAvg;
}

const getBuyAndHoldProfitAndDuration = (
  firstAndLastCandles: [Candle, Candle]
): [number, number] => {
  const [startCandle, endCandle] = firstAndLastCandles;

  const startPrice = startCandle.open;
  const endPrice = endCandle.close;

  const profit = (endPrice - startPrice) / startPrice;
  const duration = endCandle.time - startCandle.time;

  return [profit, duration];
};

const getRange = (finalState: BacktestState): Range | undefined => {
  const firstAndLastCandles = values(finalState.firstAndLastCandles);
  if (!firstAndLastCandles.length) {
    return undefined;
  }
  return {
    from: min(firstAndLastCandles.map(([first, last]) => first.time))!,
    to: max(firstAndLastCandles.map(([first, last]) => last.time))!,
  };
};
