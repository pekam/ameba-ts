import { ATR } from "technicalindicators";
import { Candle } from "../core/types";
import { createIndicatorWithPeriod } from "./indicator-util";

/**
 * Returns the value of an average true range (ATR) indicator.
 */
export const getAtr = createIndicatorWithPeriod("atr", (period) => {
  const atr = new ATR({
    close: [],
    high: [],
    low: [],
    period,
  });
  return (c: Candle) => atr.nextValue({ ...c });
});
