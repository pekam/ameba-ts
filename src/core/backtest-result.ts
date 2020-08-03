import { Trade, Transaction } from "./types";
import { timestampToUTCDateString } from "./date-util";
import { avg } from "../util";
import { CandleSeries } from "./candle-series";

export interface BacktestResult {
  trades: Trade[];
  /**
   * All the trade profits multiplied together
   */
  profit: number;
  /**
   * The multiplier of how much the balance changed
   */
  result: number;
  tradeCount: number;
  successRate: number;
  averageProfit: number;
  maxProfits: number[];
  /**
   * How much was the relative value change during the series
   */
  buyAndHoldProfit: number;
}

export function convertToBacktestResult(
  transactions: Transaction[],
  series: CandleSeries
): BacktestResult {
  const trades: Trade[] = convertToTrades(transactions);

  const profits: number[] = trades.map((trade) => trade.profit);

  const result: number = profits.reduce(
    (acc, current) => acc * (1 + current),
    1
  );

  const maxProfits: number[] = profits
    .slice()
    .sort()
    .reverse()
    .slice(0, Math.min(3, profits.length));

  // Note: the period used in backtesting might not include the entire series
  const buyAndHoldProfit =
    (series.last.close - series[0].open) / series[0].open;

  return {
    trades,
    result,
    profit: result - 1,
    tradeCount: trades.length,
    successRate: profits.filter((profit) => profit > 0).length / trades.length,
    averageProfit: avg(profits),
    maxProfits,
    buyAndHoldProfit,
  };
}

function convertToTrades(transactions: Transaction[]): Trade[] {
  return (
    transactions
      // Every other transaction is an exit.
      // If the last entry didn't close, it's ignored.
      .filter((_, i) => i % 2 === 1)
      .map((exit, i) => {
        const entry = transactions[i * 2];
        const position = entry.sell ? "short" : "long";
        const profit = entry.sell
          ? (entry.price - exit.price) / entry.price
          : (exit.price - entry.price) / entry.price;
        return {
          entry,
          exit,
          position,
          profit,
          period:
            timestampToUTCDateString(entry.time) +
            " - " +
            timestampToUTCDateString(exit.time),
        };
      })
  );
}
