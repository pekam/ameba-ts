import { properties } from "../properties";
import { CandleSeries, toCandleSeries } from "../core/candle-series";

const FtxRest = require("ftx-api-rest");

const { ftx_api_key, ftx_s } = properties;
const subaccount = undefined;

const api = new FtxRest({
  key: ftx_api_key,
  secret: ftx_s.substr(1),
  subaccount,
});

async function get(path: string) {
  return api.request({ method: "GET", path }).then((response) => {
    if (response.success) {
      return response.result;
    } else {
      throw Error("Request to FTX not successful");
    }
  });
}

async function getAccount() {
  return get("/account");
}

export type Pair = "BTC/USD";

const resolutionsInSeconds = [15, 60, 300, 900, 3600, 14400, 86400];
const resolutionValues = [
  "15sec",
  "1min",
  "5min",
  "15min",
  "1h",
  "4h",
  "1d",
] as const;
export type FtxResolution = typeof resolutionValues[number];

async function getCandles(params: {
  marketName: Pair;
  resolution: FtxResolution;
  startTime: number;
  endTime: number;
}): Promise<CandleSeries> {
  const resInSecs =
    resolutionsInSeconds[resolutionValues.indexOf(params.resolution)];
  // optional "limit" parameter omitted
  return get(
    `/markets/${params.marketName}/candles?resolution=${resInSecs}` +
      `&start_time=${params.startTime}&end_time=${params.endTime}`
  ).then((candles) =>
    // ftx returns time in milliseconds, which is inconsistent with finnhub
    toCandleSeries(candles.map((c) => ({ ...c, time: c.time / 1000 })))
  );
}

export const ftx = {
  getAccount,
  getCandles,
};
