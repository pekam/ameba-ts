import { backtestStrategy } from "../core/backtest";
import { withRelativeTransactionCost } from "../core/backtest-result";
import { loadFtxDataFromDb } from "./ftx-db";
import { SmaPullbackStrategy } from "../strats/sma-pullback-strat";

async function run() {
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
