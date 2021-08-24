import { Candle } from "../core/types";
import { m } from "../shared/functions";
import { Moment, toDateString, toTimestamp } from "../shared/time-util";
import { fetchFromFinnhub } from "./finnhub";

export type Resolution = "1" | "5" | "15" | "30" | "60" | "D" | "W" | "M";

export interface CandleRequest {
  market: "forex" | "stock";
  symbol: string;
  resolution: Resolution;
  from: Moment;
  to: Moment;
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

/**
 * Fetches the candle stick price data of a stock or a currency.
 */
export function loadCandles(options: CandleRequest): Promise<Candle[]> {
  console.log("\nFetching data with params:", {
    ...options,
    from: toDateString(options.from),
    to: toDateString(options.to),
  });

  const optionsWihtTimestamps = {
    ...options,
    from: toTimestamp(options.from),
    to: toTimestamp(options.to),
  };

  return fetchFromFinnhub(options.market, "candle", optionsWihtTimestamps).then(
    (json) => {
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

      const candles: Candle[] = data.o.map((_, index) => {
        return {
          open: data.o[index],
          high: data.h[index],
          low: data.l[index],
          close: data.c[index],
          volume: data.v && data.v[index],
          time: data.t[index],
        };
      });

      console.log(
        "Candles loaded for time period: " +
          toDateString(candles[0].time) +
          " - " +
          toDateString(m.last(candles).time)
      );
      return candles;
    }
  );
}
