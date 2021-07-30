import _ from "lodash";
import { CandleSeries } from "../core/types";
import { m } from "../shared/functions";
import { ftxResolutionToPeriod, toTimestamp } from "../shared/time-util";
import { FtxClient, FtxMarket, FtxResolution } from "./ftx";

export interface FtxWallet {
  usd: number;
  coin: number;
  coinUsdValue: number;
  totalUsdValue: number;
}

export function getFtxUtil({
  ftx,
  market,
}: {
  ftx: FtxClient;
  market: FtxMarket;
}) {
  async function getWallet(): Promise<FtxWallet> {
    const balances = await ftx.getBalances();
    const usdBalance = balances.find((b) => b.coin === "USD");
    const coinBalance = balances.find((b) => b.coin === market.split("/")[0]);

    const usd = usdBalance ? usdBalance.total : 0;
    const coin = coinBalance ? coinBalance.total : 0;
    const coinUsdValue = coinBalance ? coinBalance.usdValue : 0;

    const totalUsdValue = usd + coinUsdValue;

    return {
      usd,
      coin,
      coinUsdValue,
      totalUsdValue,
    };
  }

  async function getQuote() {
    const orderBook = await ftx.getOrderBook({ market, depth: 1 });
    const bid = orderBook.bids[0].price;
    const ask = orderBook.asks[0].price;
    return { bid, ask };
  }

  async function getState() {
    const [account, wallet, quote] = await Promise.all([
      ftx.getAccount(),
      getWallet(),
      getQuote(),
    ]);
    return { ...account, ...wallet, ...quote };
  }

  async function getTotalUsdValue(): Promise<number> {
    const allBalances = await ftx.getBalances();
    return m.sum(allBalances.map((b) => b.usdValue));
  }

  /**
   * This assumes that long positions were taken.
   */
  async function getRecentTradeProfits() {
    const fills = await ftx.getFills({ market, limit: 200 });

    // Subsequent buy and sell fills collected to a single buy or sell trade.
    const trades = fills.reduce<
      { side: "buy" | "sell"; size: number; avgPrice: number }[]
    >((acc, next) => {
      const prev = acc[acc.length - 1];
      if (!prev || prev.side !== next.side) {
        return [
          ...acc,
          {
            side: next.side,
            avgPrice: next.price,
            size: next.size,
          },
        ];
      }
      const size = prev.size + next.size;
      const avgPrice =
        (prev.size / size) * prev.avgPrice + (next.size / size) * next.price;
      return [
        ...acc.slice(0, acc.length - 1),
        { side: prev.side, avgPrice, size },
      ];
    }, []);

    const profits = trades
      .slice(
        trades[0].side === "buy" ? 1 : 0,
        m.last(trades).side === "sell" ? trades.length - 1 : trades.length
      )
      .reduce<number[]>((acc, next, index, arr) => {
        if (index % 2 === 0) {
          return acc;
        }
        const sell = arr[index - 1];
        const buy = next;

        if (buy.side !== "buy" || sell.side !== "sell") {
          throw Error("Expected buy and sell order");
        }

        const profit = (sell.avgPrice - buy.avgPrice) / buy.avgPrice;

        return [...acc, profit];
      }, []);

    return profits;
  }

  /**
   * Splits the time into multiple requests because ftx returns max 5000 candles at once.
   *
   * Takes start and end as strings in format YYYY-MM-DD or as timestamps.
   */
  async function getCandles({
    startDate,
    endDate,
    resolution,
  }: {
    startDate: string | number;
    endDate: string | number;
    resolution: FtxResolution;
  }): Promise<CandleSeries> {
    const [startTime, endTime]: number[] = [startDate, endDate].map(
      (date: string | number) => {
        if (typeof date === "number") {
          return date;
        } else {
          return toTimestamp(date);
        }
      }
    );

    const maxSecondsPerRequest = ftxResolutionToPeriod[resolution] * 5000;

    const results = await Promise.all(
      m
        .range(Math.ceil((endTime - startTime) / maxSecondsPerRequest))
        .map((i) => {
          const start = startTime + i * maxSecondsPerRequest;
          const end = Math.min(
            startTime + (i + 1) * maxSecondsPerRequest,
            endTime
          );
          return ftx.getCandles({
            startTime: start,
            endTime: end,
            resolution,
            market,
          });
        })
    );
    return m.filterConsecutiveDuplicates(_.flatten(results));
  }

  return {
    ftx,
    market,
    getWallet,
    getQuote,
    getState,
    getRecentTradeProfits,
    getCandles,
  };
}

export type FtxUtil = ReturnType<typeof getFtxUtil>;
