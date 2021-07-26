import { timestampToUTCDateString } from "../core/date-util";
import { Candle } from "../core/types";
import { m } from "../shared/functions";
import { fetchFromFinnhub } from "./finnhub";

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

/**
 * Fetches the candle stick price data of a stock or a currency.
 */
export function loadCandles(options: CandleRequest): Promise<Candle[]> {
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
        timestampToUTCDateString(candles[0].time) +
        " - " +
        timestampToUTCDateString(m.last(candles).time)
    );
    return candles;
  });
}
