import { flatMap, sortBy } from "lodash";
import { m } from "../shared/functions";
import { InternalTradeState } from "./backtest";
import { CandleSeries, Range, Trade } from "./types";

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
   * inclusive).
   */
  range: Range;
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
  const {
    range: { from, to },
    cash: endBalance,
  } = finalState;
  const initialBalance = finalState.args.initialBalance;
  const trades = getTradesInOrder(finalState);

  if (!from || !to) {
    throw Error("There were no candles to backtest with.");
  }
  const range = { from, to };

  const stats: BacktestStatistics = {
    initialBalance,
    endBalance,
    relativeProfit: (endBalance - initialBalance) / initialBalance,
    tradeCount: trades.length,
    successRate:
      trades.filter((t) => t.absoluteProfit > 0).length / trades.length,
    buyAndHoldProfit: getBuyAndHoldProfit(
      Object.values(finalState.args.series),
      range
    ),
    range,
  };
  return { trades, stats };
}

function getTradesInOrder(state: InternalTradeState) {
  return sortBy(
    flatMap(state.assets, (a) => a.trades),
    (t) => t.entry.time
  );
}

function getBuyAndHoldProfit(series: CandleSeries[], range: Range): number {
  const profitsAndDurations: [number, number][] = series.map(
    getBuyAndHoldProfitAndDuration(range)
  );

  const totalWeight = m.sum(
    profitsAndDurations.map(([profit, duration]) => duration)
  );
  const weightedAvg = m.sum(
    profitsAndDurations.map(
      ([profit, duration]) => (profit * duration) / totalWeight
    )
  );

  return weightedAvg;
}

const getBuyAndHoldProfitAndDuration: (
  range: Range
) => (series: CandleSeries) => [number, number] = (range) => (series) => {
  if (!series.length) {
    return [0, 0];
  }
  const startCandle = series.find((c) => c.time >= range.from);
  if (!startCandle) {
    return [0, 0];
  }
  const endCandle = series.find((c) => c.time >= range.to) || m.last(series);
  const startPrice = startCandle.open;
  const endPrice = endCandle.close;

  const profit = (endPrice - startPrice) / startPrice;
  const duration = endCandle.time - startCandle.time;

  return [profit, duration];
};
