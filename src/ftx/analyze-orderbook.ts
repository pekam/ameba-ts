import { ftxDb } from "./ftx-db";
import { m } from "../functions/functions";
import { ftx, FtxMarket, OrderBook } from "./ftx";
import { timestampFromUTC, timestampToUTCDateString } from "../core/date-util";

const threshold = 0.0001;

function score(book: OrderBook): number {
  const a = (book.asks.find((e) => e.relDiff > threshold) || m.last(book.asks))
    .cumulative;
  const b = (book.bids.find((e) => e.relDiff > threshold) || m.last(book.bids))
    .cumulative;
  return b;
  // return Math.max(...book.bids.slice(0, 10).map((b) => b.volume));
}

async function run() {
  const market: FtxMarket = "FTT/USD";

  const series = await ftx.getCandleSeries({
    market,
    resolution: "1min",
    startTime: timestampFromUTC(2021, 2, 1),
    endTime: timestampFromUTC(2021, 2, 6),
  });
  console.log(series.length);
  console.log(series[0].utcDateString);

  const books = await ftxDb.loadOrderBooksFromDb(market);
  const result = m.sortDescending(books, score).filter((book) => {
    const i = series.findIndex((c) => c.time > book.time) - 2;
    const c = series[i];
    if (!c) {
      return false;
    }
    return c.relativeChange > 0.001;
    // const sma = m.last(
    //   SMA.calculate({
    //     values: series.slice(0, i + 1).map((asdf) => asdf.close),
    //     period: 20,
    //   })
    // );
    // return c.close > sma;
  });

  console.log(
    result.slice(0, 20).map((book) => ({
      market: book.market,
      price: book.midPrice,
      time: book.time,
      utcDateString: timestampToUTCDateString(book.time),
      score: score(book),
    }))
  );
}
run();
