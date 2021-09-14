import {
  CandleSeries,
  MarketPosition,
  Order,
  Strategy,
  TradeState,
} from "../core/types";
import { m } from "../shared/functions";
import {
  ftxResolutionToPeriod,
  getCurrentTimestampInSeconds,
  PERIODS,
  toDateString,
} from "../shared/time-util";
import { clearLastLine, restartOnError, sleep } from "../util";
import { FtxResolution } from "./ftx";
import { FtxUtil, FtxWallet } from "./ftx-util";

interface BotBArgs {
  strat: Strategy;
  resolution: FtxResolution;
  ftxUtil: FtxUtil;
  leverage?: number;
}

async function run(args: BotBArgs) {
  await restartOnError(() => doRun(args), PERIODS.minute * 2);
}

/**
 * Runs a Strategy (the same type that can be used with the backtester)
 * in FTX.
 */
async function doRun({
  strat,
  resolution,
  ftxUtil,
  leverage,
}: BotBArgs): Promise<void> {
  /*
   * Consider exiting any existing positions when starting the bot.
   * This would simplify things, as the strategies wouldn't need to
   * take into account that there might already be a position on the
   * first run of update(), and there might not be e.g. a stopLoss
   * that should be activated based on entry price.
   */

  const candlePeriod = ftxResolutionToPeriod[resolution];
  const requiredCandles = 1000;

  let state: TradeState = {
    series: [],
    position: null,

    entryOrder: null,
    stopLoss: null,
    takeProfit: null,

    transactions: [],
  };

  while (true) {
    await sleepAndUpdateExitsUntilNextCandle(state, candlePeriod, ftxUtil);

    // Just reset by cancelling all orders and setting them later if needed
    await ftxUtil.ftx.cancelAllOrders(ftxUtil.market);

    const now = getCurrentTimestampInSeconds();
    const [series, wallet]: [CandleSeries, FtxWallet] = await Promise.all([
      ftxUtil.getCandles({
        resolution,
        startDate: now - candlePeriod * requiredCandles,
        endDate: now + 1000,
      }),
      ftxUtil.getWallet(),
    ]);
    console.log({ now: toDateString(now, true) });
    state.series = filterIncompleteCandleIfNeeded(series, candlePeriod);
    state.position = getCurrentPosition(wallet);

    const updates = strat(state);
    state = { ...state, ...updates };
    console.log({ updates, state: { ...state, series: null } });

    // Entry order
    if (!state.position && state.entryOrder) {
      const targetUsdValue = wallet.totalUsdValue * (leverage || 1);
      const target = targetUsdValue / state.entryOrder.price;
      const size =
        state.entryOrder.side === "buy"
          ? target - wallet.coin
          : target + wallet.coin;

      await addOrder(state.entryOrder, size, ftxUtil);
    }
  }
}

function filterIncompleteCandleIfNeeded(
  series: CandleSeries,
  period: number
): CandleSeries {
  const candleTime = m.last(series).time;
  const now = getCurrentTimestampInSeconds();
  if (isOnSameCandle(candleTime, now, period)) {
    console.log(
      "Removed incomplete candle at " + toDateString(candleTime, true)
    );
    return series.slice(0, series.length - 1);
  }
  return series;
}

async function addOrder(order: Order, size: number, ftxUtil: FtxUtil) {
  if (order.type === "limit") {
    await ftxUtil.ftx.addOrder({
      market: ftxUtil.market,
      price: order.price,
      type: order.type,
      side: order.side,
      size,
      postOnly: false,
    });
  } else if (order.type === "stop") {
    await ftxUtil.addStopOrder({
      market: ftxUtil.market,
      triggerPrice: order.price,
      side: order.side,
      size,
    });
  } else {
    throw Error("Unhandled order type");
  }
}

function isOnSameCandle(time1: number, time2: number, period: number): boolean {
  return Math.floor(time1 / period) === Math.floor(time2 / period);
}

async function sleepAndUpdateExitsUntilNextCandle(
  {
    stopLoss,
    takeProfit,
  }: { stopLoss: number | null; takeProfit: number | null },
  period: number,
  ftxUtil: FtxUtil
) {
  const startTime = getCurrentTimestampInSeconds();

  let oldPosition: MarketPosition | null = null;

  let skipClearingLines = true;
  let logPrefix = "";

  while (isOnSameCandle(getCurrentTimestampInSeconds(), startTime, period)) {
    skipClearingLines || clearLastLine(3);
    skipClearingLines = false;

    console.log(logPrefix, {
      s: toDateString(startTime, true),
      e: toDateString(getCurrentTimestampInSeconds(), true),
    });
    logPrefix += ".";

    const wallet = await ftxUtil.getWallet();
    const nextPosition = getCurrentPosition(wallet);
    console.log({
      totalUsd: wallet.totalUsdValue,
      coinUsd: wallet.coinUsdValue,
    });

    if (!oldPosition && nextPosition) {
      console.log("Entered, setup exit orders");
      await setupExitOrders({
        position: nextPosition,
        stopLoss: stopLoss,
        takeProfit: takeProfit,
        ftxUtil,
        wallet,
      });
      skipClearingLines = true;
    }
    if (oldPosition && !nextPosition) {
      console.log("Exited, cancel the potential other exit order");
      await ftxUtil.ftx.cancelAllOrders(ftxUtil.market);
      skipClearingLines = true;
    }

    oldPosition = nextPosition;

    await sleep(5 * 1000);
  }
}

async function setupExitOrders({
  position,
  stopLoss,
  takeProfit,
  ftxUtil,
  wallet,
}: {
  position: MarketPosition;
  stopLoss: number | null;
  takeProfit: number | null;
  ftxUtil: FtxUtil;
  wallet: FtxWallet;
}) {
  const exitSide = position === "long" ? "sell" : "buy";

  const promises = [];

  if (stopLoss) {
    promises.push(
      addOrder(
        {
          price: stopLoss,
          side: exitSide,
          type: "stop",
        },
        Math.abs(wallet.coin),
        ftxUtil
      )
    );
  }

  if (takeProfit) {
    promises.push(
      addOrder(
        {
          price: takeProfit,
          side: exitSide,
          type: "limit",
        },
        Math.abs(wallet.coin),
        ftxUtil
      )
    );
  }
  return Promise.all(promises);
}

function getCurrentPosition(wallet: FtxWallet): MarketPosition | null {
  const posLimit = Math.min(wallet.totalUsdValue / 4, 20);
  if (wallet.coinUsdValue > posLimit) {
    return "long";
  } else if (wallet.coinUsdValue < -posLimit) {
    return "short";
  } else {
    return null;
  }
}

export const botB = {
  run,
};
