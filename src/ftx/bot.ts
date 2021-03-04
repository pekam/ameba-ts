import { FtxMarket, FtxResolution, getFtxClient } from "./ftx";
import { getCurrentTimestampInSeconds, sleep } from "../util";
import { m } from "../functions/functions";
import { CandleSeries } from "../core/candle-series";
import { FtxBotOrder } from "./market-maker-orders";

export type FtxBotStrat = (params: {
  series: CandleSeries;
  lastOrder: FtxBotOrder;
}) => boolean;

/**
 * safeZoneMargin:
 * How much the price needs to change from previous order to trigger a new order,
 * even if the other conditions would tell to change the position. This avoids
 * going back-and-forth "at the limit" (e.g. MA crossover point), wasting money.
 *
 * candleSeriesLookBack:
 * How long into the history will candles be loaded for each iteration
 * of the strategy.
 */
export async function runFtxBot(params: {
  subaccount: string;
  market: FtxMarket;
  strat: FtxBotStrat;
  safeZoneMargin: number;
  resolution: FtxResolution;
  candleSeriesLookBack: number;
  enter: () => Promise<FtxBotOrder>;
  exit: () => Promise<FtxBotOrder>;
}) {
  let retrySleep = 1000;
  while (true) {
    try {
      await run(params, () => (retrySleep = 1000));
    } catch (e) {
      console.error(e);
      console.log(`Restarting after ${retrySleep}ms...`);
      await sleep(retrySleep);
      retrySleep = Math.min(retrySleep * 1.5, 60 * 1000);
    }
  }
}

async function run(
  {
    resolution,
    subaccount,
    market,
    safeZoneMargin,
    candleSeriesLookBack,
    strat,
    enter,
    exit,
  }: {
    subaccount: string;
    market: FtxMarket;
    strat: FtxBotStrat;
    safeZoneMargin: number;
    resolution: FtxResolution;
    candleSeriesLookBack: number;
    enter: () => Promise<FtxBotOrder>;
    exit: () => Promise<FtxBotOrder>;
  },
  afterSuccessfulIteration: () => void
) {
  const ftx = getFtxClient({ subaccount });

  async function getRecentCandles() {
    const now = getCurrentTimestampInSeconds();
    return ftx.getCandleSeries({
      market,
      resolution,
      startTime: now - candleSeriesLookBack,
      endTime: now,
    });
  }

  let lastOrder: FtxBotOrder;
  while (true) {
    console.log(" ----- " + new Date() + " ----- ");
    const series = await getRecentCandles();
    if (
      shouldBeLong({
        series,
        lastOrder,
        strat,
        safeZoneMargin,
      })
    ) {
      console.log("begin entry");
      const order = await enter();
      console.log(order ? "entry finished" : "already entered");
      lastOrder = order || lastOrder;
    } else {
      console.log("begin exit");
      const order = await exit();
      console.log(order ? "exit finished" : "already exited");
      lastOrder = order || lastOrder;
    }
    afterSuccessfulIteration();
    console.log("sleeping for 10s");
    await sleep(10 * 1000);
  }
}

function shouldBeLong({
  series,
  lastOrder,
  strat,
  safeZoneMargin,
}: {
  series: CandleSeries;
  lastOrder: FtxBotOrder;
  strat: FtxBotStrat;
  safeZoneMargin: number;
}) {
  const currentPrice = m.last(series).close;
  console.log({
    currentPrice,
    lastOrder: lastOrder && lastOrder.price,
  });

  const longCondition = strat({ series, lastOrder });

  if (!lastOrder) {
    return longCondition;
  }

  const inSafeZone = isInSafeZone(
    series,
    currentPrice,
    lastOrder,
    safeZoneMargin
  );

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
  lastOrder: FtxBotOrder,
  safeZoneMargin: number
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
