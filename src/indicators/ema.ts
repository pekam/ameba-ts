import { EMA } from "technicalindicators";
import { Candle } from "../core/types";
import { createIndicatorWithPeriod } from "./indicator-util";

/**
 * Returns the value of an exponential moving average (EMA) indicator.
 */
export const getEma = createIndicatorWithPeriod("ema", (period) => {
  const ema = new EMA({ period, values: [] });
  return (c: Candle) => ema.nextValue(c.close);
});
