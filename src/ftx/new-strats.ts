import { CandleSeries } from "../core/types";
import { m } from "../shared/functions";
import { indicators } from "../shared/indicators";
import { getRiskBasedOnDrawdown } from "../shared/risk-management";
import { FtxBotOrder } from "./market-maker-orders";

/**
 * Example of a strategy function that would return a multiplier for current
 * capital to use as the stake. >1 should use leverage, <0 should short-sell.
 */
export function newStrat({
  series,
  currentPosition,
  lastOrder,
  accountValue,
  peakAccountValue,
}: {
  series: CandleSeries;
  currentPosition: number;
  lastOrder?: FtxBotOrder;
  accountValue: number;
  peakAccountValue: number;
}): number {
  if (isInSafeZone({ series, lastOrder, safeZoneMargin: 0.02 })) {
    return currentPosition;
  }

  const [emaShort, emaLong, emaHuge] = [5, 20, 100].map((period) =>
    getEma(series, period)
  );
  const lookingForLongTrades = emaLong > emaHuge;
  const bullish = emaShort > emaLong;

  // prettier-ignore
  const base = lookingForLongTrades
      ? (bullish ? 1 : 0)
      : (bullish ? 0 : -1);

  const riskMultiplier = getRiskBasedOnDrawdown({
    accountValue,
    peakAccountValue,
    maxDrawdown: 0.1,
    maxRisk: 1,
    minRisk: 0.5,
  });

  return riskMultiplier * base;
}

function getEma(series: CandleSeries, period: number) {
  return m.last(getEmas(series, period, 1));
}

function getEmas(series: CandleSeries, period: number, limit: number) {
  return indicators.ema(series, period).values.slice(-limit);
}
function isInSafeZone({
  series,
  lastOrder,
  safeZoneMargin,
}: {
  series: CandleSeries;
  lastOrder?: FtxBotOrder;
  safeZoneMargin: number;
}): boolean {
  if (!lastOrder) {
    return false;
  }
  const safeZone = {
    low: lastOrder.price * (1 - safeZoneMargin),
    high: lastOrder.price * (1 + safeZoneMargin),
  };

  const candlesSinceLastOrder = m.takeCandlesAfter(series, lastOrder.time);

  console.log("candles since last order", candlesSinceLastOrder.length);

  if (candlesSinceLastOrder.length > 0) {
    const sinceLastOrder = m.combine(candlesSinceLastOrder);

    if (
      sinceLastOrder.high > safeZone.high ||
      sinceLastOrder.low < safeZone.low
    ) {
      console.log("safezone broken since last order");
      return false;
    }
  }
  const currentPrice = m.last(series).close;

  return m.isBetween({ value: currentPrice, ...safeZone });
}
