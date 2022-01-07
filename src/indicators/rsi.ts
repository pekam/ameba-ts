import { RSI } from "technicalindicators";
import { Candle } from "../core/types";
import { createIndicatorWithPeriod } from "./indicator-util";

/**
 * Returns the value of a relative strength index (RSI) indicator.
 */
export const getRsi = createIndicatorWithPeriod("rsi", (period) => {
  const rsi = new RSI({ period, values: [] });
  return (c: Candle) => rsi.nextValue(c.close);
});
