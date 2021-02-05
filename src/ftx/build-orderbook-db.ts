import { FtxMarkets } from "./ftx";
import { ftxDb } from "./ftx-db";

const interval = 1000 * 60;

FtxMarkets.forEach((market) => {
  setInterval(() => {
    ftxDb
      .loadOrderBookToDb({ market, depth: 100 })
      .then(() => console.log(`${market} orderbook loaded to db`));
  }, interval);
});
