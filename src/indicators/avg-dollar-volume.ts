import { SMA } from "technicalindicators";
import { Candle } from "../core/types";
import { getDollarVolume } from "../util/candle-util";
import { createIndicatorWithPeriod } from "./indicator-util";

/**
 * Returns the value of a simple moving average of the dollar volume (candle's
 * volume multiplied by its average price).
 */
export const getAvgDollarVolume = createIndicatorWithPeriod(
  "avgDollarVol",
  (period) => {
    const avgDollarVol = new SMA({ period, values: [] });
    return (c: Candle) => avgDollarVol.nextValue(getDollarVolume(c));
  }
);
