import { CandleSeries, Trade, Transaction } from "./types";
import { timestampToUTCDateString } from "./date-util";
import { m } from "../functions/functions";
import _ = require("lodash");

export interface BacktestStatistics {
  /**
   * Transaction cost used to calculate this result.
   * E.g. 0.001 for 0.1% transaction cost per each buy and sell transaction.
   */
  relativeTransactionCost: number;
  /**
   * All the trade profits multiplied together
   */
  profit: number;
  /**
   * The multiplier of how much the balance changed
   */
  result: number;
  profitWithConstantStake: number;
  tradeCount: number;
  successRate: number;
  averageProfit: number;
  maxProfits: number[];
  /**
   * How much was the relative value change during the series
   */
  buyAndHoldProfit: number;
}

export interface BacktestResult {
  trades: Trade[];
  stats: BacktestStatistics;
}

export function convertToBacktestResult(
  transactions: Transaction[],
  series: CandleSeries
): BacktestResult {
  const trades: Trade[] = convertToTrades(transactions);
  return tradesToResult(trades, getBuyAndHoldProfit([series]), 0);
}

/**
 * Combines the individual backtest results.
 * The buy-and-hold-profit will be the average
 * of all the serieses.
 */
export function combineResults(
  results: BacktestResult[],
  serieses: CandleSeries[]
) {
  const relativeTransactionCost = results[0].stats.relativeTransactionCost;
  if (
    results.some(
      (r) => r.stats.relativeTransactionCost !== relativeTransactionCost
    )
  ) {
    throw new Error(
      "The backtest results to combine have inconsistent transaction costs."
    );
  }
  const allTrades: Trade[] = _.flatMap(results, (r) => r.trades);
  return tradesToResult(
    allTrades,
    getBuyAndHoldProfit(serieses),
    relativeTransactionCost
  );
}

function tradesToResult(
  trades: Trade[],
  buyAndHoldProfit: number,
  relativeTransactionCost: number
): BacktestResult {
  const profits: number[] = trades.map((trade) => trade.profit);

  const result: number = profits.reduce(
    (acc, current) => acc * (1 + current),
    1
  );

  const profitWithConstantStake = m.sum(profits);

  const maxProfits: number[] = profits
    .slice()
    .sort()
    .reverse()
    .slice(0, Math.min(3, profits.length));

  return {
    trades,
    stats: {
      result,
      profit: result - 1,
      profitWithConstantStake,
      tradeCount: trades.length,
      successRate:
        profits.filter((profit) => profit > 0).length / trades.length,
      averageProfit: m.avg(profits),
      maxProfits,
      buyAndHoldProfit,
      relativeTransactionCost,
    },
  };
}

/**
 * Simulates transaction costs and slippage by adding
 * a cost relative to the entry and exit prices.
 *
 * @param cost e.g. 0.001 to have 0.1% cost per transaction
 * @return a new result with the costs applied
 */
export function withRelativeTransactionCost(
  result: BacktestResult,
  relativeCost: number
) {
  const updatedTrades = result.trades.map((trade) => ({
    ...trade,
    profit: getTradeProfit(trade, relativeCost),
  }));
  return tradesToResult(
    updatedTrades,
    result.stats.buyAndHoldProfit,
    relativeCost
  );
}

function convertToTrades(transactions: Transaction[]): Trade[] {
  return (
    transactions
      // Every other transaction is an exit.
      // If the last entry didn't close, it's ignored.
      .filter((_, i) => i % 2 === 1)
      .map((exit, i) => {
        const entry = transactions[i * 2];
        const position = entry.side === "buy" ? "long" : "short";
        const profit = getTradeProfit({ entry, exit });
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

function getBuyAndHoldProfit(serieses: CandleSeries[]): number {
  // Note: the period used in backtesting might not include the entire series
  return m.avg(
    serieses.map(
      (series) => (m.last(series).close - series[0].open) / series[0].open
    )
  );
}

function getTradeProfit({ entry, exit }, relativeTransactionCost = 0) {
  const transactionCosts =
    relativeTransactionCost * entry.price +
    relativeTransactionCost * exit.price;

  if (entry.sell) {
    return (entry.price - exit.price - transactionCosts) / entry.price;
  } else {
    return (exit.price - entry.price - transactionCosts) / entry.price;
  }
}
