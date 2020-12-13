import { CandleSeries } from "../core/candle-series";
import { avg, range } from "../util";
import { Candle } from "../core/types";

/**
 */
export function getAverageCandleSize(
  series: CandleSeries,
  countFromEnd: number
) {
  const head: Candle[] =
    series.length >= countFromEnd ? series.slice(-countFromEnd) : series;
  return avg(head.map((candle) => candle.high - candle.low));
}

/**
 * Returns the indices of candles which have a local maximum.
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
 * Returns the indices of candles which have a local minimum.
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
  }, []);
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
  const index = candle.index;
  const neighbours = range(distanceToCompare)
    .map((dist) => dist + 1)
    .reduce((acc, dist) => {
      return acc.concat(series[index - dist], series[index + dist]);
    }, []);

  return neighbours.every(
    (neighbour) => neighbour !== undefined && comparator(candle, neighbour)
  );
}
