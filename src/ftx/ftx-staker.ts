import { getFtxUtil } from "./ftx-util";
import { getRiskBasedOnDrawdown } from "../functions/risk-management";
import { CandleSeries } from "../core/types";
import { getCurrentTimestampInSeconds } from "../util";
import { m } from "../functions/functions";
import { getFtxSubAccountProperties } from "../properties";
import { FtxBotStrat } from "./bot";
import { withRelativeTransactionCost } from "../core/backtest-result";
import { backtestStrategy } from "../core/backtest";
import { getBacktestableStrategy } from "./strats";
import { FtxMarket, getFtxClient } from "./ftx";

function getStakeMultiplier(
  accountValue: number,
  peakAccountValueIfUsingRiskManagement?: number
) {
  if (peakAccountValueIfUsingRiskManagement === undefined) {
    return 1;
  } else {
    return getRiskBasedOnDrawdown({
      accountValue,
      peakAccountValue: peakAccountValueIfUsingRiskManagement,
      maxDrawdown: 0.1,
      maxRisk: 1,
      minRisk: 0.5,
    });
  }
}

function getBacktestStaker(strat: FtxBotStrat) {
  const backtestIntervalSec = 10 * 60; // 10min
  const transactionCost = 0.0005;

  let lastTimeBacktested: number;
  let multiplier: number;

  return async (series: CandleSeries) => {
    const now = getCurrentTimestampInSeconds();

    if (!lastTimeBacktested || now > lastTimeBacktested + backtestIntervalSec) {
      const result = withRelativeTransactionCost(
        await backtestStrategy(() => getBacktestableStrategy(strat), series),
        transactionCost
      );
      const trades = result.trades;
      if (trades.length >= 2 && trades[0].entry.time > trades[1].entry.time) {
        throw Error("Expected trades to be in chronological order");
      }
      const profits = trades
        .map((t) => t.profit)
        .reverse()
        .slice(0, 20);
      const weightedAvg = m.getWeightedAverage(profits);
      console.log(profits);

      if (weightedAvg < -0.002) {
        multiplier = 0;
      } else if (weightedAvg < -0.0015) {
        multiplier = 0.2;
      } else if (weightedAvg < -0.001) {
        multiplier = 0.4;
      } else if (weightedAvg < -0.0005) {
        multiplier = 0.6;
      } else if (weightedAvg < 0) {
        multiplier = 0.8;
      } else {
        multiplier = 1;
      }

      console.log("backtest completed");
      console.log({ weightedAvg, trades: result.trades.length, multiplier });
      lastTimeBacktested = getCurrentTimestampInSeconds();
    }
    return multiplier;
  };
}

/**
 *
 * @param ftxUtil
 */
export function getFtxStaker({
  subaccount,
  market,
  stakeByPeakAccountValue,
  stratIfStakingByBacktest,
}: {
  subaccount: string;
  market: FtxMarket;
  stakeByPeakAccountValue: boolean;
  stratIfStakingByBacktest?: FtxBotStrat;
}) {
  const ftxUtil = getFtxUtil({ ftx: getFtxClient({ subaccount }), market });
  /*
   * Set in properties file to enable scaling down the stakes based on drawdown. The peak account value
   * needs to be provided here manually, because FTX doesn't have API to fetch it.
   * This is supported only for non-margin trading.
   */
  const peakAccountValue: number | undefined = getFtxSubAccountProperties(
    ftxUtil.ftx.subaccount
  ).peak;

  const backtestStaker =
    stratIfStakingByBacktest && getBacktestStaker(stratIfStakingByBacktest);

  async function howMuchCanBuy(series: CandleSeries) {
    const {
      spotMarginEnabled,
      usd,
      coin,
      totalUsdValue,
      bid,
      collateral,
      leverage,
    } = await ftxUtil.getState();

    if (!spotMarginEnabled) {
      const stakeMultiplier = await (async () => {
        let multiplier = 1;
        if (stakeByPeakAccountValue) {
          multiplier *= getStakeMultiplier(totalUsdValue, peakAccountValue);
        }
        if (backtestStaker) {
          multiplier *= await backtestStaker(series);
        }
        if (multiplier > 1) return 1;
        if (multiplier < 0) return 0;
        return multiplier;
      })();

      const targetPositionUsdValue = totalUsdValue * stakeMultiplier;
      const currentPositionUsdValue = coin * bid;
      const howMuchStillCanBuyUsdValue = Math.max(
        targetPositionUsdValue - currentPositionUsdValue,
        0
      );
      console.log({
        totalUsdValue,
        peak: peakAccountValue,
        stakeMultiplier,
        targetPositionUsdValue,
        currentPositionUsdValue,
        howMuchStillCanBuyUsdValue,
      });
      return {
        value: howMuchStillCanBuyUsdValue / bid,
        usdValue: howMuchStillCanBuyUsdValue,
        price: bid,
      };
    } else {
      const maxPosition = getMaxPositionOnMargin(collateral, leverage, bid);
      const diff = maxPosition - coin;
      const value = Math.max(diff, 0);
      return { value, usdValue: value * bid, price: bid };
    }
  }

  async function howMuchCanSell() {
    const {
      spotMarginEnabled,
      coin,
      ask,
      totalUsdValue,
      collateral,
      leverage,
    } = await ftxUtil.getState();

    if (!spotMarginEnabled) {
      return { value: coin, usdValue: coin * ask, price: ask };
    } else {
      const maxPosition = getMaxPositionOnMargin(collateral, leverage, ask);
      const diff = maxPosition + coin;
      const value = Math.max(diff, 0);
      return { value, usdValue: value * ask, price: ask };
    }
  }

  function getMaxPositionOnMargin(
    collateral: number,
    leverage: number,
    price: number
  ) {
    /*
     * Not using leverage at the moment, but the max leverage in FTX settings
     * needs to be more than 1x so it can go 1x collateral long/short.
     */
    const maxPositionUsd = collateral; /* * leverage */
    const maxPosition = maxPositionUsd / price;
    return maxPosition;
  }

  return {
    howMuchCanBuy,
    howMuchCanSell,
  };
}

export type FtxStaker = ReturnType<typeof getFtxStaker>;
