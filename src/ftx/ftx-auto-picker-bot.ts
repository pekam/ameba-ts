import { flatten, maxBy } from "lodash";
import { backtest } from "../core/backtest";
import { allInStaker, TradingStrategy, withStaker } from "../core/staker";
import { getCurrentTimestampInSeconds } from "../shared/time-util";
import { sleep } from "../util";
import { botB } from "./bot-b";
import { FtxMarket, FtxResolution, getFtxClient } from "./ftx";
import { ftxDataStore } from "./ftx-data-store";
import { getFtxUtil } from "./ftx-util";

/*
Automaticaly picks the crypto + strategy combination that has recently
produced the best outcome, and runs it wiht bot-b.
*/

interface AutoPickerArgs {
  subaccount: string;
  resolution: FtxResolution;
  markets: FtxMarket[];
  strats: (() => TradingStrategy)[];
  pickInterval: number;
  lookbackPeriod: number;
  resultThreshold: number;
  requiredCandles: number;
}

async function run(args: AutoPickerArgs) {
  const { subaccount, resolution, pickInterval, requiredCandles } = args;
  const ftx = getFtxClient({ subaccount });

  while (true) {
    ftx.cancelAllOrders();
    const picked = await pickMarketAndStrategy(args);
    const lastPickTime = getCurrentTimestampInSeconds();

    if (picked) {
      await botB.run({
        ftxUtil: getFtxUtil({
          ftx,
          market: picked.market,
        }),
        stratProvider: picked.stratProvider,
        resolution: resolution,
        requiredCandles,
        stopper: (state) =>
          !state.position &&
          getCurrentTimestampInSeconds() - lastPickTime > pickInterval,
      });
    } else {
      await sleep(pickInterval * 1000);
    }
  }
}

async function pickMarketAndStrategy({
  resolution,
  markets,
  strats,
  lookbackPeriod,
  resultThreshold,
}: AutoPickerArgs) {
  const now = getCurrentTimestampInSeconds();
  const allResults = flatten(
    await Promise.all(
      markets.map(async (market) => {
        const series = await ftxDataStore.getCandles({
          market,
          resolution,
          startDate: now - lookbackPeriod,
          endDate: now,
        });
        return strats.map((stratProvider, i) => {
          const result = backtest({
            strategy: withStaker(stratProvider, allInStaker),
            series: { _: series },
            showProgressBar: false,
          });
          console.log(
            `Tested ${market} with strategy ${i}, profit ${result.stats.relativeProfit}`
          );
          return { market, stratProvider, result };
        });
      })
    )
  );
  const best = maxBy(allResults, (result) => {
    // TODO improve performance metrics
    return result.result.stats.relativeProfit;
  });
  if (!best) {
    return null;
  }
  const result = best.result.stats.relativeProfit;
  if (result < resultThreshold) {
    console.log(
      `TRADING PAUSED. The best result ${result} is less than the threshold ${resultThreshold}.`
    );
    return null;
  }
  console.log(
    `PICKED ${best.market} with strategy ${strats.indexOf(
      best.stratProvider
    )}, result ${result}.`
  );
  return best;
}

export const ftxAutoPickerBot = {
  run,
};
