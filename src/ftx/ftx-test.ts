import { backtestStrategy } from "../core/backtest";
import { withRelativeTransactionCost } from "../core/backtest-result";
import { getFtxClient } from "./ftx";
import { timestampFromUTC, timestampToUTCDateString } from "../core/date-util";
import { Candle, CandleSeries, Strategy, TradeState } from "../core/types";
import { m } from "../functions/functions";
import { FtxBotStrat } from "./bot";
import { emaStrat, getEmaStrat } from "./strats";
import { getFtxUtil } from "./ftx-util";
import { readDataFromFile, writeDataToFile } from "../data/data-caching";
import { FtxBotOrder } from "./market-maker-orders";

async function run() {
  const ftx = getFtxClient({ subaccount: "bot-2" });

  const util = getFtxUtil({ ftx, market: "FTT/USD" });

  const save = writeDataToFile;
  const load = readDataFromFile;

  const candles: CandleSeries = load("ftt.json");

  const result = backtestStrategy(
    () => getBacktestableStrategy(emaStrat),
    candles
  );

  console.log(result.stats);
  console.log(withRelativeTransactionCost(result, 0.0007).stats);

  save(
    [result.stats, withRelativeTransactionCost(result, 0.0007).stats],
    "res1"
  );

  return;

  const candleSeries = await util.getMinuteCandles({
    startDate: "2021-02-20",
    endDate: "2021-06-01",
  });

  candleSeries.forEach((c, i, a) => {
    if (i > 0) {
      const prev = a[i - 1];
      const diff = c.time - prev.time;
      if (diff !== 60) {
        console.error("diff " + diff + " index " + i);
        console.log(timestampToUTCDateString(c.time));
        console.log(timestampToUTCDateString(prev.time));
      }
    }
  });
  console.log(candleSeries.length / 24 / 60);
  console.log(timestampToUTCDateString(candleSeries[0].time));
  console.log(timestampToUTCDateString(m.last(candleSeries).time));

  save(candleSeries, "ftt.json");

  return;

  const profits = await util.getRecentTradeProfits();

  console.log(profits);
  console.log(profits.length);

  console.log(m.avg(profits));
  console.log(m.sum(profits));

  console.log(m.getWeightedAverage(profits));

  return;

  const series = await ftx.getCandles({
    market: "SUSHI/USD",
    resolution: "1min",
    startTime: timestampFromUTC(2021, 3, 1),
    endTime: timestampFromUTC(2021, 3, 4),
  });

  const backtestResult = backtestStrategy(
    () => getBacktestableStrategy(getEmaStrat(5, 20), true),
    series
  );

  console.log(backtestResult.stats);
  const resultWithTransactionCosts = withRelativeTransactionCost(
    backtestResult,
    0.0005
  );
  console.log(resultWithTransactionCosts.stats);
  console.log(
    timestampToUTCDateString(series[0].time),
    timestampToUTCDateString(m.last(series).time)
  );
}
run();

/**
 * NOTE: Be careful if the the strat uses lastOrder, as it is not perfectly mocked.
 */
function getBacktestableStrategy(
  ftxStrat: FtxBotStrat,
  shortingEnabled: boolean = false
): Strategy {
  let lastOrder: FtxBotOrder | undefined = undefined;

  const updateLastOrder = (lastCandle: Candle, side: "buy" | "sell") => {
    lastOrder = {
      price: lastCandle.close,
      side,
      time: lastCandle.time,
      id: 0,
      size: 1,
    };
  };

  return {
    init(tradeState: TradeState): void {},
    update(state: TradeState) {
      const series = state.series;
      const last = m.last(series);

      const shouldBeLong = ftxStrat({ series, lastOrder });

      if (!state.position) {
        if (shouldBeLong) {
          updateLastOrder(last, "buy");
          return {
            entryOrder: {
              price: last.close * 1.1,
              type: "limit",
              side: "buy",
            },
          };
        } else {
          updateLastOrder(last, "sell");
          return {
            entryOrder: shortingEnabled
              ? {
                  side: "sell",
                  price: last.close * 0.9,
                  type: "limit",
                }
              : null,
          };
        }
      }

      if (state.position === "long" && !shouldBeLong) {
        updateLastOrder(last, "sell");
        return { takeProfit: last.close * 0.9 };
      }

      if (state.position === "short" && shouldBeLong) {
        updateLastOrder(last, "buy");
        return { takeProfit: last.close * 1.1 };
      }
      return {};
    },
  };
}
