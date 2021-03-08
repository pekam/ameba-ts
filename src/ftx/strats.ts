import { CandleSeries } from "../core/candle-series";
import { FtxBotOrder } from "./market-maker-orders";
import { m } from "../functions/functions";
import { indicators } from "../functions/indicators";

export const emaStrat = getEmaStrat(5, 20);

export function getEmaStrat(shortEmaPeriod, longEmaPeriod) {
  return function ({
    series,
    lastOrder,
  }: {
    series: CandleSeries;
    lastOrder: FtxBotOrder;
  }) {
    const emaShort = getEma(series, shortEmaPeriod);
    const emaLong = getEma(series, longEmaPeriod);
    console.log({
      emaShort,
      emaLong,
    });

    const longCondition = emaShort > emaLong;

    return longCondition;
  };
}

/**
 * Uses crossover of longer EMAs to ride the trends, unless the last crossover
 * has happened recently. In that case, uses crossover of shorter EMAs, as mean
 * reversion is likely.
 */
export function tripleEmaStrat({
  series,
  lastOrder,
}: {
  series: CandleSeries;
  lastOrder: FtxBotOrder;
}) {
  const lookback = 10;

  const emaTiny = getEmas(series, 2, lookback);
  const emaShort = getEmas(series, 5, lookback);
  const emaLong = getEmas(series, 20, lookback);

  const longCondition = m.last(emaShort) > m.last(emaLong);
  const tinyLongCondition = m.last(emaTiny) > m.last(emaShort);

  const recentlyCrossed = m
    .range(emaShort.length)
    .some((i) => emaShort[i] > emaLong[i] !== longCondition);

  console.log({
    longCondition,
    tinyLongCondition,
    recentlyCrossed,
  });

  if (recentlyCrossed) {
    return tinyLongCondition;
  } else {
    const conflictingSignals = longCondition !== tinyLongCondition;
    if (conflictingSignals) {
      const currentlyLong = lastOrder && lastOrder.side === "buy";
      return currentlyLong;
    }
    return longCondition;
  }
}

function getEma(series: CandleSeries, period: number) {
  return m.last(getEmas(series, period, 1));
}

function getEmas(series: CandleSeries, period: number, limit: number) {
  return indicators
    .ema(series.slice(-(period + limit + 5)), period)
    .values.slice(-limit);
}
