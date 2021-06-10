import { FtxAddOrderParams } from "./ftx";
import { getCurrentTimestampInSeconds } from "../util";
import { FtxUtil } from "./ftx-util";
import { FtxStaker } from "./ftx-staker";

/**
 * How much the $ value of a buy/sell order must exceed to try to keep ordering.
 * Trying to buy/sell too small amounts causes errors.
 */
const orderThresholdUsd = 10;

export const getFtxMarketOrders = (ftxUtil: FtxUtil, staker: FtxStaker) => {
  async function doMarketOrder(
    howMuchCanBuyOrSell: () => Promise<{
      value: number;
      usdValue: number;
      price: number;
    }>,
    side: "buy" | "sell"
  ) {
    const { value, usdValue, price } = await howMuchCanBuyOrSell();
    if (usdValue < orderThresholdUsd) {
      // Can't buy/sell more.
      return;
    }
    const params: FtxAddOrderParams = {
      type: "market",
      size: value,
      postOnly: false,
      market: ftxUtil.market,
      side,
      price: 0,
    };
    const { id } = await ftxUtil.ftx.addOrder(params);
    return { ...params, id, price, time: getCurrentTimestampInSeconds() };
  }

  return {
    enterWithMarketOrder: () => {
      return doMarketOrder(() => staker.howMuchCanBuy([]), "buy");
    },
    exitWithMarketOrder: () => {
      return doMarketOrder(staker.howMuchCanSell, "sell");
    },
  };
};
