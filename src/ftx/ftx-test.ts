import { backtestStrategy } from "../core/backtest";
import { withRelativeTransactionCost } from "../core/backtest-result";
import { loadFtxDataFromDb } from "./ftx-db";
import { SmaPullbackStrategy } from "../strats/sma-pullback-strat";
import { ftx, FtxMarkets, OrderBook } from "./ftx";
import { m } from "../functions/functions";
import _ = require("lodash");

async function run() {
  const books: OrderBook[] = await Promise.all(
    FtxMarkets.map((m) => ftx.getOrderBook(m, 100))
  );

  console.log(books[0]);

  const biggestDiff = m.sortDescending(
    books.map((book) => {
      const askVolume = m.last(
        _.takeWhile(book.asks, (entry) => entry.relDiff < 0.005)
      ).cumulative;
      const bidVolume = m.last(
        _.takeWhile(book.bids, (entry) => entry.relDiff < 0.005)
      ).cumulative;
      return { book, diff: (askVolume - bidVolume) / askVolume };
    }),
    (res) => Math.abs(res.diff)
  )[0];

  console.log({ market: biggestDiff.book.market, diff: biggestDiff.diff });

  return;

  const series = await loadFtxDataFromDb("bar");

  const backtestResult = backtestStrategy(
    () => new SmaPullbackStrategy(),
    series
  );
  console.log({ ...backtestResult, trades: [] });
  const resultWithTransactionCosts = withRelativeTransactionCost(
    backtestResult,
    0.0005
  );
  console.log({ ...resultWithTransactionCosts, trades: [] });
}
run();
