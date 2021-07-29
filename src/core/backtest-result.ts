import _ from "lodash";
import { m } from "../shared/functions";
import { CandleSeries, Range, Trade, Transaction } from "./types";

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
  transactions: Transaction[],
  series: CandleSeries,
  range: Range
): BacktestResult {
  const trades: Trade[] = convertToTrades(transactions);
  return tradesToResult(trades, getBuyAndHoldProfit([series], range), 0, range);
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
  const range = results[0].stats.range;
  if (
    results.some(
      (r) => r.stats.range.from !== range.from || r.stats.range.to !== range.to
    )
  ) {
    throw new Error(
      "The backtest results to combine have inconsistent ranges."
    );
  }

  const allTrades: Trade[] = _.flatMap(results, (r) => r.trades);
  return tradesToResult(
    allTrades,
    getBuyAndHoldProfit(serieses, range),
    relativeTransactionCost,
    range
  );
}

function tradesToResult(
  trades: Trade[],
  buyAndHoldProfit: number,
  relativeTransactionCost: number,
  range: Range
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
      range,
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
    relativeCost,
    result.stats.range
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
        };
      })
  );
}

function getBuyAndHoldProfit(serieses: CandleSeries[], range: Range): number {
  return m.avg(
    serieses.map((series) => {
      if (!series.length) {
        return 0;
      }
      const startCandle = series.find((c) => c.time === range.from);
      if (!startCandle) {
        throw Error("Candle with range start time not found");
      }
      const endCandle = series.find((c) => c.time === range.to);
      if (!endCandle) {
        throw Error("Candle with range end time not found");
      }
      const startPrice = startCandle.open;
      const endPrice = endCandle.close;
      return (endPrice - startPrice) / startPrice;
    })
  );
}

function getTradeProfit(
  { entry, exit }: { entry: Transaction; exit: Transaction },
  relativeTransactionCost = 0
) {
  const transactionCosts =
    relativeTransactionCost * entry.price +
    relativeTransactionCost * exit.price;

  if (entry.side === "sell") {
    return (entry.price - exit.price - transactionCosts) / entry.price;
  } else {
    return (exit.price - entry.price - transactionCosts) / entry.price;
  }
}
