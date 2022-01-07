import { ADX } from "technicalindicators";
import { Candle } from "../core/types";
import { createIndicatorWithPeriod } from "./indicator-util";

/**
 * Returns the value of an average directional index (ADX) indicator, along with
 * the associated positive and negative directional indicators (PDI and MDI).
 */
export const getAdx = createIndicatorWithPeriod<{
  adx: number;
  pdi: number;
  mdi: number;
}>("adx", (period) => {
  const adx = new ADX({
    close: [],
    high: [],
    low: [],
    period,
  });
  // @ts-ignore TS defs have wrong argument type
  return (c: Candle) => adx.nextValue({ ...c });
});
