import * as fs from "fs";
import path from "path";
import { range } from "remeda";
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
  /**
   * Returns a series that opens from 1 and increases in price by 1 with each
   * candle, without any wicks.
   */
  getSimpleTestData,
  /**
   * Returns a series where each candle opens and closes at the provided
   * startValue, but has a tail/wick of the provided size (positive value for
   * tail above the candle, negative for below).
   */
  getTails,
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

function getSimpleTestData(candleCount: number): CandleSeries {
  return range(1, candleCount + 1).map((i) => ({
    open: i,
    close: i + 1,

    low: i,
    high: i + 1,

    time: i,
  }));
}

function getTails({
  startValue,
  tails,
}: {
  startValue: number;
  tails: number[];
}): CandleSeries {
  return tails.map((tail, index) => ({
    time: index + 1,
    open: startValue,
    close: startValue,
    high: tail > 0 ? startValue + tail : startValue,
    low: tail < 0 ? startValue + tail : startValue,
  }));
}
