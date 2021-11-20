import * as fs from "fs";
import path from "path";
import { CandleSeries } from "../../src/core/types";

export const testData = {
  /**
  Daily candles of Amazon stock in June 2020,
  loaded from Finnhub with parameters:
  ```
  {
    market: "stock",
    symbol: "AMZN",
    resolution: "D",
    from: timestampFromUTC(2020, 6, 1),
    to: timestampFromUTC(2020, 7, 1),
  }
  ```
  The array contains 22 candles.
   */
  getAmznDaily: () => loadCandlesFromFile("amzn-daily.json"),
  /**
  Candles loaded from FTX with parameters:
  ```
  {
    market: "BTC/USD",
    resolution: "1h",
    startDate: "2021-10-01",
    endDate: "2021-10-10",
  }
  ```
  The array contains 216 candles.
   */
  getBtcHourly: () => loadCandlesFromFile("btc-hourly.json"),
};

function loadCandlesFromFile(fileName: string): CandleSeries {
  const filePath = path.join(__dirname, fileName);
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return data.map(
    ({
      o,
      h,
      l,
      c,
      t,
      v,
    }: {
      o: number;
      h: number;
      l: number;
      c: number;
      t: number;
      v: number;
    }) => ({
      open: o,
      high: h,
      low: l,
      close: c,
      time: t,
      volume: v,
    })
  );
}
