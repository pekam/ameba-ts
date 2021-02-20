import { ftx } from "./ftx";
import { getCurrentTimestampInSeconds, sleep } from "../util";
import { EMA } from "technicalindicators";
import { m } from "../functions/functions";
import { CandleSeries } from "../core/candle-series";
import {
  enterAsMarketMaker,
  exitAsMarketMaker,
  FtxBotOrder,
} from "./market-maker-orders";

const market = "BTC/USD";

/**
 * How much the price needs to change from previous order to trigger a new order,
 * even if the other conditions would tell to change the position. This avoids
 * going back-and-forth "at the limit" (e.g. MA crossover point), wasting money.
 */
const safeZoneMargin = 0.001;

(async function () {
  let lastOrder: FtxBotOrder;
  while (true) {
    console.log(" ----- " + new Date() + " ----- ");
    const series = await getRecentCandles();
    if (shouldBeLong({ series, lastOrder })) {
      lastOrder = (await enterAsMarketMaker()) || lastOrder;
    } else {
      lastOrder = (await exitAsMarketMaker()) || lastOrder;
    }
    console.log("sleeping for 10s");
    await sleep(10 * 1000);
  }
})();

function shouldBeLong({
  series,
  lastOrder,
}: {
  series: CandleSeries;
  lastOrder: FtxBotOrder;
}) {
  const currentPrice = m.last(series).close;
  const emaShort = getEma(series, 5);
  const emaLong = getEma(series, 20);
  console.log({
    emaShort,
    emaLong,
    currentPrice,
    lastOrder: lastOrder && lastOrder.price,
  });

  const longCondition = emaShort > emaLong;

  if (!lastOrder) {
    return longCondition;
  }

  const inSafeZone = isInSafeZone(series, currentPrice, lastOrder);

  const currentlyLong = lastOrder.side === "buy";

  if (inSafeZone) {
    console.log("in safe zone, no position change");
    return currentlyLong;
  } else {
    return longCondition;
  }
}

function isInSafeZone(
  series: CandleSeries,
  currentPrice: number,
  lastOrder: FtxBotOrder
): boolean {
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

  return m.isBetween({ value: currentPrice, ...safeZone });
}

function getEma(series: CandleSeries, period: number) {
  return m.last(
    EMA.calculate({ values: series.slice(-50).map((c) => c.close), period })
  );
}

async function getRecentCandles() {
  return ftx.getCandleSeries({
    market,
    resolution: "1min",
    startTime: getCurrentTimestampInSeconds() - 60 * 60 * 6, // 6h
    endTime: getCurrentTimestampInSeconds(),
  });
}
