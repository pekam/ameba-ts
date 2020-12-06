import { CandleSeries } from "../core/candle-series";
import { avg } from "../util";
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
export function findHighIndices(series: CandleSeries): number[] {
  return filterIndices(
    series.map((candle) => candle.high),
    isLocalMax
  );
}

/**
 * Returns the indices of candles which have a local minimum.
 */
export function findLowIndices(series: CandleSeries): number[] {
  return filterIndices(
    series.map((candle) => candle.low),
    isLocalMin
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

function isLocalMax(series: number[], index: number): boolean {
  return compareToNeighbours(
    series,
    index,
    (current, neighbour) => current > neighbour
  );
}

function isLocalMin(series: number[], index: number): boolean {
  return compareToNeighbours(
    series,
    index,
    (current, neighbour) => current < neighbour
  );
}

function compareToNeighbours(
  series: number[],
  index: number,
  comparator: (current: number, neighbour: number) => boolean
): boolean {
  const current = series[index];
  const previous = series[index - 1];
  const next = series[index + 1];

  return (
    previous !== undefined &&
    next !== undefined &&
    comparator(current, previous) &&
    comparator(current, next)
  );
}
