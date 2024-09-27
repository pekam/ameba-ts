import { SMA } from "technicalindicators";
import { Candle } from "../core/types";
import { createIndicatorWithPeriod } from "./indicator-util";

/**
 * Returns the value of an average volume indicator.
 */
export const getAvgVolume = createIndicatorWithPeriod("avgVol", (period) => {
  const avgVol = new SMA({ period, values: [] });
  return (c: Candle) => avgVol.nextValue(c.volume);
});
