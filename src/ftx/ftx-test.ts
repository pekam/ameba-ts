import { backtestStrategy } from "../core/backtest";
import { withRelativeTransactionCost } from "../core/backtest-result";
import { SmaPullbackStrategy } from "../strats/sma-pullback-strat";
import { getFtxClient } from "./ftx";
import { getFtxDb } from "./ftx-db";

async function run() {
  const ftx = getFtxClient({ subaccount: undefined });
  const ftxDb = getFtxDb(ftx);

  // const result = await ftx.addOrder({
  //   market: "BTC/USD",
  //   price: 42000,
  //   side: "buy",
  //   size: 0.002,
  //   type: "limit",
  //   postOnly: true,
  // });
  // console.log(result.id);
  //
  // console.log(result);

  const openOrders = await ftx.getOpenOrders("BTC/USD");
  console.log(openOrders);

  const res = await ftx.cancelAllOrders("BTC/USD");
  console.log(res);

  console.log(await ftx.getOpenOrders("BTC/USD"));

  return;

  setTimeout(async () => {
    const result = await ftx.cancelOrder(openOrders[0].id);
    console.log(result);
  }, 5000);

  return;

  await ftxDb.loadOrderBookToDb({ market: "BTC/USD", depth: 100 });
  const books = await ftxDb.loadOrderBooksFromDb("BTC/USD");
  console.log(books);

  return;

  const series = await ftxDb.loadCandleDataFromDb("bar");

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
