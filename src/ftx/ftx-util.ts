import { FtxClient, FtxMarket } from "./ftx";
import { m } from "../functions/functions";
import { CandleSeries } from "../core/candle-series";
import _ = require("lodash");

export function getFtxUtil({
  ftx,
  market,
}: {
  ftx: FtxClient;
  market: FtxMarket;
}) {
  async function getWallet() {
    const balances = await ftx.getBalances();
    const usdBalance = balances.find((b) => b.coin === "USD");
    const coinBalance = balances.find((b) => b.coin === market.split("/")[0]);

    const usd = usdBalance ? usdBalance.total : 0;
    const coin = coinBalance ? coinBalance.total : 0;

    const totalUsdValue = usd + (coinBalance ? coinBalance.usdValue : 0);

    return { usd, coin, totalUsdValue };
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
   * Takes start and end as strings in format YYYY-MM-DD.
   */
  async function getMinuteCandles({
    startDate,
    endDate,
  }: {
    startDate: string;
    endDate: string;
  }): Promise<CandleSeries> {
    const startTime = m.dateStringToTimestamp(startDate);
    const endTime = m.dateStringToTimestamp(endDate);

    const maxSeconds = 60 * 60 * 24 * 3;

    const results = await Promise.all(
      m.range(Math.ceil((endTime - startTime) / maxSeconds)).map((i) => {
        const start = startTime + i * maxSeconds;
        const end = Math.min(startTime + (i + 1) * maxSeconds, endTime);
        return ftx.getCandles({
          startTime: start,
          endTime: end,
          resolution: "1min",
          market,
        });
      })
    );
    return _.flatten(results).filter((candle, i, array) => {
      // Filter duplicates
      const prev = array[i - 1];
      return !prev || prev.time !== candle.time;
    });
  }

  return {
    ftx,
    market,
    getWallet,
    getQuote,
    getState,
    getRecentTradeProfits,
    getMinuteCandles,
  };
}

export type FtxUtil = ReturnType<typeof getFtxUtil>;
