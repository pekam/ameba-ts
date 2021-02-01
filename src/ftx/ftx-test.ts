import { backtestStrategy } from "../core/backtest";
import { withRelativeTransactionCost } from "../core/backtest-result";
import { ftxDb } from "./ftx-db";
import { SmaPullbackStrategy } from "../strats/sma-pullback-strat";

async function run() {
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
