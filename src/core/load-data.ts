import { CandleSeries } from "./candle-series";
import { RawCandle } from "./types";
import { timestampToUTCDateString } from "./date-util";
import { fetchFromFinnhub } from "../finnhub";

export type Resolution = "1" | "5" | "15" | "30" | "60" | "D" | "W" | "M";

export interface CandleRequest {
  market: "forex" | "stock";
  symbol: string;
  resolution: Resolution;
  from: number;
  to: number;
}

interface FinnhubCandleResponse {
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  v: number[];
  t: number[];
  s: string;
}

export function loadCandles(options: CandleRequest): Promise<CandleSeries> {
  console.log("\nFetching data with params:", {
    ...options,
    from: timestampToUTCDateString(options.from),
    to: timestampToUTCDateString(options.to),
  });

  return fetchFromFinnhub(options.market, "candle", options).then((json) => {
    const data: FinnhubCandleResponse = json;

    if (data.s === "no_data") {
      throw new Error("No data received.");
    }

    const length = data.o.length;

    if (
      !(
        data.h.length === length &&
        data.l.length === length &&
        data.c.length === length &&
        (!data.v || data.v.length === length) &&
        data.t.length === length
      )
    ) {
      throw new Error(
        "Invalid data. Candlestick property lists have unequal lengths."
      );
    }

    const candles: RawCandle[] = data.o.map((_, index) => {
      return {
        open: data.o[index],
        high: data.h[index],
        low: data.l[index],
        close: data.c[index],
        volume: data.v && data.v[index],
        time: data.t[index],
      };
    });

    const series = new CandleSeries(...candles);
    console.log(
      "Candle series initialized for time period: " +
        series[0].utcDateString +
        " - " +
        series.last.utcDateString
    );
    return series;
  });
}
