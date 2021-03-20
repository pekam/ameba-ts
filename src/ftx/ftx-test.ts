import { backtestStrategy } from "../core/backtest";
import { withRelativeTransactionCost } from "../core/backtest-result";
import { getFtxClient } from "./ftx";
import { timestampFromUTC, timestampToUTCDateString } from "../core/date-util";
import { Strategy, TradeState } from "../core/types";
import { m } from "../functions/functions";
import { FtxBotStrat } from "./bot";
import { getEmaStrat } from "./strats";
import { getFtxUtil } from "./ftx-util";

async function run() {
  const ftx = getFtxClient({ subaccount: "bot-2" });

  const util = getFtxUtil({ ftx, market: "FTT/USD" });

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

  console.log({ ...backtestResult, trades: [] });
  const resultWithTransactionCosts = withRelativeTransactionCost(
    backtestResult,
    0.0005
  );
  console.log({ ...resultWithTransactionCosts, trades: [] });
  console.log(
    timestampToUTCDateString(series[0].time),
    timestampToUTCDateString(m.last(series).time)
  );
}
run();

function getBacktestableStrategy(
  ftxStrat: FtxBotStrat,
  shortingEnabled: boolean = false
): Strategy {
  return {
    init(tradeState: TradeState): void {},
    update(state: TradeState) {
      const series = state.series;
      const last = m.last(series);

      const shouldBeLong = ftxStrat({ series, lastOrder: undefined });

      if (!state.position) {
        if (shouldBeLong) {
          return {
            entryOrder: {
              price: last.close * 1.1,
              type: "limit",
              side: "buy",
            },
          };
        } else {
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
        return { takeProfit: last.close * 0.9 };
      }

      if (state.position === "short" && shouldBeLong) {
        return { takeProfit: last.close * 1.1 };
      }
      return {};
    },
  };
}
