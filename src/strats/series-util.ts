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
export function findHighIndices(
  series: CandleSeries,
  distanceToCompare = 1
): number[] {
  return filterIndices(
    series.map((candle) => candle.high),
    (series, num) => isLocalMax(series, num, distanceToCompare)
  );
}

/**
 * Returns the indices of candles which have a local minimum.
 */
export function findLowIndices(
  series: CandleSeries,
  distanceToCompare = 1
): number[] {
  return filterIndices(
    series.map((candle) => candle.low),
    (series, num) => isLocalMin(series, num, distanceToCompare)
  );
}

function filterIndices(
  series: number[],
  filter: (series: number[], index: number) => boolean
) {
  return series.reduce((acc, current, index) => {
    if (filter(series, index)) {
      return acc.concat(index);
    }
    return acc;
  }, []);
}

function isLocalMax(
  series: number[],
  index: number,
  distanceToCompare
): boolean {
  return compareToNeighbours(
    series,
    index,
    (current, neighbour) => current > neighbour,
    distanceToCompare
  );
}

function isLocalMin(
  series: number[],
  index: number,
  distanceToCompare
): boolean {
  return compareToNeighbours(
    series,
    index,
    (current, neighbour) => current < neighbour,
    distanceToCompare
  );
}

function compareToNeighbours(
  series: number[],
  index: number,
  comparator: (current: number, neighbour: number) => boolean,
  distanceToCompare
): boolean {
  const current = series[index];

  const neighbours = range(distanceToCompare)
    .map((dist) => dist + 1)
    .reduce((acc, dist) => {
      return acc.concat(series[index - dist], series[index + dist]);
    }, []);

  return neighbours.every(
    (num) => num !== undefined && comparator(current, num)
  );
}
