import { SMA } from "technicalindicators";
import { Candle } from "../core/types";
import { createIndicatorWithPeriod } from "./indicator-util";

/**
 * Returns the value of a simple moving average (SMA) indicator.
 */
export const getSma = createIndicatorWithPeriod("sma", (period) => {
  const sma = new SMA({ period, values: [] });
  return (c: Candle) => sma.nextValue(c.close);
});
