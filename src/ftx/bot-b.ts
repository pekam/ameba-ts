import { AssetState, FullTradeState } from "../core/backtest";
import { allInStaker, TradingStrategy, withStaker } from "../core/staker";
import { CandleSeries, MarketPosition, Order } from "../core/types";
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
  stratProvider: () => TradingStrategy;
  resolution: FtxResolution;
  ftxUtil: FtxUtil;
  requiredCandles: number;
  stopper?: (state: AssetState) => boolean;
}

async function run(args: BotBArgs) {
  await restartOnError(() => doRun(args), PERIODS.minute * 2);
}

/**
 * Runs a Strategy (the same type that can be used with the backtester)
 * in FTX.
 *
 * Note that transactions and trades are not updated in TradeState.
 */
async function doRun({
  stratProvider,
  resolution,
  ftxUtil,
  requiredCandles,
  stopper,
}: BotBArgs): Promise<void> {
  /*
   * Consider exiting any existing positions when starting the bot.
   * This would simplify things, as the strategies wouldn't need to
   * take into account that there might already be a position on the
   * first run of update(), and there might not be e.g. a stopLoss
   * that should be activated based on entry price.
   */

  const candlePeriod = ftxResolutionToPeriod[resolution];

  // TODO Staker is hard-coded here
  const strat = withStaker(stratProvider, allInStaker);

  const symbol = ftxUtil.market;

  let state: FullTradeState = {
    cash: (await ftxUtil.getWallet()).usd,
    updated: [],
    time: 0,

    assets: {
      [symbol]: {
        symbol: symbol,

        series: [],
        position: null,

        entryOrder: null,
        stopLoss: null,
        takeProfit: null,

        // not updated
        transactions: [],
        trades: [],
      },
    },
  };

  while (true) {
    await sleepAndUpdateExitsUntilNextCandle(
      state.assets[symbol],
      candlePeriod,
      ftxUtil
    );

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
    console.log({ now: toDateString(now, "s") });
    state.cash = wallet.usd;
    state.time = m.last(series).time;
    state.updated = [symbol];

    state.assets[symbol] = {
      ...state.assets[symbol],
      series: filterIncompleteCandleIfNeeded(series, candlePeriod),
      position: getCurrentPosition(wallet),
    };

    const update = strat(state).find((update) => update.symbol === symbol);
    if (update) {
      state.assets[symbol] = {
        ...state.assets[symbol],
        ...update,
      };
    }
    console.log({ update, state: { ...state.assets[symbol], series: null } });

    if (stopper && stopper(state.assets[symbol])) {
      console.log("!STOP! exiting bot-b");
      break;
    }

    // Entry order
    const assetState = state.assets[symbol];
    if (
      !assetState.position &&
      assetState.entryOrder &&
      assetState.entryOrder.size > 0
    ) {
      await addOrder(assetState.entryOrder, ftxUtil);
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
      "Removed incomplete candle at " + toDateString(candleTime, "s")
    );
    return series.slice(0, series.length - 1);
  }
  return series;
}

async function addOrder(order: Order, ftxUtil: FtxUtil) {
  if (order.type === "limit") {
    await ftxUtil.ftx.addOrder({
      market: ftxUtil.market,
      price: order.price,
      type: order.type,
      side: order.side,
      size: order.size,
      postOnly: false,
    });
  } else if (order.type === "stop") {
    await ftxUtil.addStopOrder({
      market: ftxUtil.market,
      triggerPrice: order.price,
      side: order.side,
      size: order.size,
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
      s: toDateString(startTime, "s"),
      e: toDateString(getCurrentTimestampInSeconds(), "s"),
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
          size: Math.abs(wallet.coin),
        },

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
          size: Math.abs(wallet.coin),
        },
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
