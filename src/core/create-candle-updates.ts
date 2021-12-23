import { filter, flatMap, groupBy, map, pipe, sortBy } from "remeda";
import { Candle, CandleSeries, SeriesMap } from "./types";

export interface SymbolCandlePair {
  symbol: string;
  candle: Candle;
}

/**
 * Converts the candle data to a list of updates, where each updates contains
 * the candles (one per symbol) to add at a specific timestamp.
 */
export function createCandleUpdates(
  series: SeriesMap,
  isWithinRange: (c: Candle) => boolean
): {
  time: number;
  nextCandles: SymbolCandlePair[];
}[] {
  return pipe(
    series,
    toSymbolCandlePairs,
    filter(({ candle }) => isWithinRange(candle)),
    groupBy(({ candle }) => candle.time),
    toList,
    sortBy(({ time }) => time)
  );
}

function toSymbolCandlePairs(series: SeriesMap) {
  const entries: [string, CandleSeries][] = Object.entries(series);
  return flatMap(entries, ([symbol, series]) =>
    map(series, (candle) => ({ symbol, candle }))
  );
}

function toList(input: { [time: string]: SymbolCandlePair[] }) {
  const entries: [string, SymbolCandlePair[]][] = Object.entries(input);
  return map(entries, ([timeString, nextCandles]) => ({
    time: parseInt(timeString),
    nextCandles,
  }));
}
