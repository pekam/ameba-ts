import { backtestStrategy } from "../core/backtest";
import { BacktestResult } from "../core/backtest-result";
import { Strategy } from "../core/types";
import { db } from "../data/mongo";
import { m } from "../functions/functions";
import { FtxMarket, FtxResolution, ftxResolutionToPeriod } from "./ftx";
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
  await db.set(collectionId, id, resultWithId);
  return resultWithId;
}

async function loadBacktestResult(
  id: number
): Promise<FtxBacktestResult | undefined> {
  return await db.get(collectionId, id);
}

async function backtestAndSave(args: {
  stratProvider: () => Strategy;
  market: FtxMarket;
  resolution: FtxResolution;
  from: string;
  to: string;
  candlesBefore?: number;
}): Promise<FtxBacktestResult & { id: number }> {
  const { market, stratProvider, resolution, from, to } = args;
  const candlesBefore = args.candlesBefore || 50;

  const fromTimestamp = m.toTimestamp(from);

  const series = await ftxDataStore.getCandles({
    market,
    startDate:
      fromTimestamp - ftxResolutionToPeriod[resolution] * candlesBefore,
    endDate: to,
    resolution,
  });

  const result = backtestStrategy(stratProvider, series, true, fromTimestamp);

  return await saveBacktestResult({
    result,
    market,
    resolution,
  });
}

export const ftxBacktestStore = {
  saveBacktestResult,
  loadBacktestResult,
  backtestAndSave,
};
