import { m } from "../shared/functions";
import { CandleSeries, Range, Trade, TradeState, Transaction } from "./types";

export interface BacktestStatistics {
  initialBalance: number;
  endBalance: number;
  /**
   * The change of account balance relative to the initial balance.
   */
  relativeProfit: number;
  tradeCount: number;
  successRate: number;
  /**
   * How much was the relative value change during the series
   */
  buyAndHoldProfit: number;
  /**
   * Timestamps of the first and last candle included in the backtest
   * (both inclusive)
   */
  range: Range;
}

export interface BacktestResult {
  trades: Trade[];
  stats: BacktestStatistics;
}

export function convertToBacktestResult(
  finalState: TradeState,
  initialBalance: number,
  range: Range
): BacktestResult {
  const { trades, series } = finalState;
  const endBalance = finalState.cash;
  const relativeProfit = (endBalance - initialBalance) / initialBalance;
  const buyAndHoldProfit = getBuyAndHoldProfit([series], range);
  const stats: BacktestStatistics = {
    initialBalance,
    endBalance,
    relativeProfit,
    tradeCount: trades.length,
    successRate:
      trades.filter((t) => t.absoluteProfit > 0).length / trades.length,
    buyAndHoldProfit,
    range,
  };
  return { trades, stats };
}

function getBuyAndHoldProfit(serieses: CandleSeries[], range: Range): number {
  return m.avg(
    serieses.map((series) => {
      if (!series.length) {
        return 0;
      }
      const startCandle =
        series.find((c) => c.time === range.from) || series[0];
      const endCandle =
        series.find((c) => c.time === range.to) || m.last(series);
      const startPrice = startCandle.open;
      const endPrice = endCandle.close;
      return (endPrice - startPrice) / startPrice;
    })
  );
}
