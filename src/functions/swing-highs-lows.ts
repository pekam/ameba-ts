import { CandleSeries } from "../core/candle-series";
import { Candle } from "../core/types";
import { m } from "./functions";

/**
 * Returns the candles which have a local maximum.
 */
export function getSwingHighs(
  series: CandleSeries,
  distanceToCompare = 1
): Candle[] {
  return filterCandles(series, (series, candle) =>
    isLocalMax(series, candle, distanceToCompare)
  );
}

/**
 * Returns the candles which have a local minimum.
 */
export function getSwingLows(
  series: CandleSeries,
  distanceToCompare = 1
): Candle[] {
  return filterCandles(series, (series, candle) =>
    isLocalMin(series, candle, distanceToCompare)
  );
}

function filterCandles(
  series: Candle[],
  filter: (series: Candle[], candle: Candle) => boolean
): Candle[] {
  return series.reduce((acc, current) => {
    if (filter(series, current)) {
      return acc.concat(current);
    }
    return acc;
  }, [] as CandleSeries);
}

function isLocalMax(
  series: Candle[],
  candle: Candle,
  distanceToCompare
): boolean {
  return compareToNeighbours(
    series,
    candle,
    (candle, neighbour) => candle.high > neighbour.high,
    distanceToCompare
  );
}

function isLocalMin(
  series: Candle[],
  candle: Candle,
  distanceToCompare
): boolean {
  return compareToNeighbours(
    series,
    candle,
    (candle, neighbour) => candle.low < neighbour.low,
    distanceToCompare
  );
}

function compareToNeighbours(
  series: Candle[],
  candle: Candle,
  comparator: (current: Candle, neighbour: Candle) => boolean,
  distanceToCompare
): boolean {
  const index = m.indexOf(series, candle);
  const neighbours = m
    .range(distanceToCompare)
    .map((dist) => dist + 1)
    .reduce((acc, dist) => {
      return acc.concat(series[index - dist], series[index + dist]);
    }, [] as CandleSeries);

  return neighbours.every(
    (neighbour) => neighbour !== undefined && comparator(candle, neighbour)
  );
}
