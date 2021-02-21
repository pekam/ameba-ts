import { FtxMarkets, getFtxClient } from "./ftx";
import { getFtxDb } from "./ftx-db";

const interval = 1000 * 60;

const ftx = getFtxClient({ subaccount: undefined });
const ftxDb = getFtxDb(ftx);

FtxMarkets.forEach((market) => {
  setInterval(() => {
    ftxDb
      .loadOrderBookToDb({ market, depth: 100 })
      .then(() => console.log(`${market} orderbook loaded to db`));
  }, interval);
});
