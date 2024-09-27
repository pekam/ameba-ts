import { Candle } from "../core/types";
import { avg } from "./util";

/**
 * @returns the candle's volume multiplied by its average price
 */
export const getDollarVolume = (candle: Candle) =>
  candle.volume * avg([candle.low, candle.high]);
