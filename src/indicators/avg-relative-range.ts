import { SMA } from "technicalindicators";
import { Candle } from "../core/types";
import { createIndicatorWithPeriod } from "./indicator-util";

/**
 * Returns the value of an average relative range indicator (simple moving
 * average of `(high-low)/low`).
 */
export const getAvgRelativeRange = createIndicatorWithPeriod(
  "avgRelativeRange",
  (period) => {
    const sma = new SMA({ period, values: [] });
    return (c: Candle) => sma.nextValue((c.high - c.low) / c.low);
  }
);
