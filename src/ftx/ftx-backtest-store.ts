import { backtest, FullTradingStrategy } from "../core/backtest";
import { BacktestResult } from "../core/backtest-result";
import { db } from "../data/mongo";
import { ftxResolutionToPeriod, toTimestamp } from "../shared/time-util";
import { FtxMarket, FtxResolution } from "./ftx";
import { ftxDataStore } from "./ftx-data-store";

export interface FtxBacktestResult {
  result: BacktestResult;
  market: FtxMarket;
  resolution: FtxResolution;
}

const collectionId = "ftx-backtest";

async function saveBacktestResult(
  result: FtxBacktestResult
): Promise<FtxBacktestResult & { id: number }> {
  const id: number = (await db.get(collectionId, "nextId"))?.value || 1;
  await db.set(collectionId, "nextId", { value: id + 1 });
  const resultWithId = { ...result, id };
  console.log("Backtest result saved with id " + id);
  await db.set(collectionId, id, resultWithId);
  return resultWithId;
}

async function loadBacktestResult(
  id: number
): Promise<FtxBacktestResult | undefined> {
  return await db.get(collectionId, id);
}

async function backtestWithFtxData(args: {
  strategy: FullTradingStrategy;
  market: FtxMarket;
  resolution: FtxResolution;
  from: string;
  to: string;
  candlesBefore?: number;
}): Promise<FtxBacktestResult> {
  const { market, strategy, resolution, from, to } = args;
  const candlesBefore = args.candlesBefore || 50;

  const fromTimestamp = toTimestamp(from);

  const series = await ftxDataStore.getCandles({
    market,
    startDate:
      fromTimestamp - ftxResolutionToPeriod[resolution] * candlesBefore,
    endDate: to,
    resolution,
  });

  const result = backtest({
    strategy: strategy,
    series: { _: series },
    from: fromTimestamp,
  });

  return { result, market, resolution };
}

async function backtestAndSave(args: {
  strategy: FullTradingStrategy;
  market: FtxMarket;
  resolution: FtxResolution;
  from: string;
  to: string;
  candlesBefore?: number;
}): Promise<FtxBacktestResult & { id: number }> {
  const result = await backtestWithFtxData(args);
  return await saveBacktestResult(result);
}

export const ftxBacktestStore = {
  saveBacktestResult,
  loadBacktestResult,
  backtest: backtestWithFtxData,
  backtestAndSave,
};
