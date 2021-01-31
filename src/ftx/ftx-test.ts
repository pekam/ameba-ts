import { backtestStrategy } from "../core/backtest";
import { withRelativeTransactionCost } from "../core/backtest-result";
import { loadFtxDataFromDb } from "./ftx-db";
import { SmaPullbackStrategy } from "../strats/sma-pullback-strat";
import { ftx } from "./ftx";

async function run() {
  const orderBook = await ftx.getOrderBook("BTC/USD", 10);
  console.log(orderBook);

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
