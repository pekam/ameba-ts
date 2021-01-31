import { ftx, FtxCandleRequestParams } from "./ftx";
import { db } from "../data/mongo";
import { timestampFromUTC } from "../core/date-util";
import { RawCandle } from "../core/types";
import { CandleSeries, toCandleSeries } from "../core/candle-series";

const collectionId = "ftx";

export async function loadFromFtxToDb(
  id: string,
  params: FtxCandleRequestParams
) {
  const candles = await ftx.getCandles(params);
  await db.set(collectionId, id, { params, candles });
}

export async function loadFtxDataFromDb(id: string): Promise<CandleSeries> {
  const candles: RawCandle[] = (await db.get(collectionId, id)).candles;
  return toCandleSeries(candles);
}

async function run() {
  await loadFromFtxToDb("bar", {
    marketName: "BTC/USD",
    resolution: "5min",
    startTime: timestampFromUTC(2020, 7),
    endTime: timestampFromUTC(2020, 12),
  });
}

// run();
