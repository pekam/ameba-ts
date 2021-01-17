import { CandleSeries } from "../core/candle-series";
import { rankAndReport } from "./rank-and-report";
import { m } from "../functions/functions";
import { Candle } from "../core/types";
import * as _ from "lodash";

const maxCandlesToInclude = 100;
const distanceToCompareSwingLows = 2;
const supportThreshold = 0.001;
const priceToSupportThreshold = 0.01;

/**
 * Finds series which are close to a support level.
 * Score is based on how much the price has increased between the
 * support points (bottoms).
 */
function scoreByCloseToSupport(series: CandleSeries): number {
  const candles = series.slice(-maxCandlesToInclude);
  const { bottomCandles, lowest } = findCloseBottoms(candles);
  if (bottomCandles.length < 2) {
    return 0;
  }
  if (
    m.getRelativeDiff(lowest.low, m.last(series).close) >
    priceToSupportThreshold
  ) {
    return 0;
  }
  const highestBetween = m.combine(
    m.getCandlesBetween(candles, bottomCandles[0], m.last(bottomCandles))
  ).high;
  const relativeIncreaseBetween = m.getRelativeDiff(lowest.low, highestBetween);
  return relativeIncreaseBetween;
}

function findCloseBottoms(candles: CandleSeries): BottomsResult {
  const result = getCloseBottoms(candles);
  if (result.bottomCandles.length < 2 && result.lowest) {
    const lowestLowIndex = m.indexOf(candles, result.lowest);
    const retry = getCloseBottoms(candles.slice(lowestLowIndex + 1));
    return retry;
  }
  return result;
}

function getCloseBottoms(series: CandleSeries): BottomsResult {
  const swingLows = m.getSwingLows(series, distanceToCompareSwingLows);
  const lowestLowCandle = _.minBy(swingLows, (c) => c.low);
  const closeBottoms = swingLows.filter((c) => isLowClose(lowestLowCandle, c));
  return { bottomCandles: closeBottoms, lowest: lowestLowCandle };
}

interface BottomsResult {
  bottomCandles: Candle[];
  lowest: Candle | null;
}

function isLowClose(c1: Candle, c2: Candle) {
  const relativeLowDiff = m.getRelativeDiff(c1.low, c2.low);
  return relativeLowDiff < supportThreshold;
}

rankAndReport("jan17", scoreByCloseToSupport, 30);
