import { Indicators } from "..";
import { AssetState, Candle } from "../core/types";
import { useState } from "../core/use-state";

// Example of how indicator APIs could be built on top of useState
export function getSma(
  asset: AssetState,
  period: number,
  candle?: Candle
): number | undefined {
  // Ideally the indicator implementations would be split out of the Indicators class.
  const [indicators] = useState(asset, new Indicators({ smaPeriod: period }));
  const { sma } = indicators.update(asset.series);

  if (candle) {
    return indicators.get(candle)?.sma;
  }

  return sma;
}
