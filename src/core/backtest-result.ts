import { flatMap, sortBy, sumBy } from "lodash";
import { identity, map, maxBy, minBy, pipe, values } from "remeda";
import { InternalTradeState, updateAsset } from "./backtest";
import { revertLastTransaction } from "./backtest-order-execution";
import { Candle, Range, Trade } from "./types";

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
   * (migh not be relevant if the strategy trades both long and short
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

export function convertToBacktestResult(
  finalState: InternalTradeState
): BacktestResult {
  // Only finished trades are included in the result. Another option would be to
  // close all open trades with the current market price, but exiting against
  // the strategy's logic would be skew the result in a worse way.
  return pipe(finalState, revertUnclosedTrades, (finalState) => {
    const initialBalance = finalState.args.initialBalance;
    const trades = getTradesInOrder(finalState);

    const endBalance = finalState.cash;

    const stats: BacktestStatistics = {
      initialBalance,
      endBalance,
      relativeProfit: (endBalance - initialBalance) / initialBalance,
      tradeCount: trades.length,
      successRate:
        trades.filter((t) => t.absoluteProfit > 0).length / trades.length,
      buyAndHoldProfit: getBuyAndHoldProfit(finalState),
      range: getRange(finalState),
    };
    return { trades, stats };
  });
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

function getTradesInOrder(state: InternalTradeState) {
  return sortBy(
    flatMap(state.assets, (a) => a.trades),
    (t) => t.entry.time
  );
}

function getBuyAndHoldProfit(state: InternalTradeState): number {
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

const getRange = (state: InternalTradeState): Range | undefined => {
  const firstAndLastCandles = values(state.firstAndLastCandles);
  if (!firstAndLastCandles.length) {
    return undefined;
  }
  return {
    from: pipe(
      firstAndLastCandles,
      map(([first, last]) => first.time),
      minBy(identity)
    )!,
    to: pipe(
      firstAndLastCandles,
      map(([first, last]) => last.time),
      maxBy(identity)
    )!,
  };
};
