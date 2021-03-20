import { FtxAddOrderParams, FtxMarket, getFtxClient } from "./ftx";
import { getCurrentTimestampInSeconds, sleep, toFixed } from "../util";
import { getFtxUtil } from "./ftx-util";
import { getFtxStaker } from "./get-ftx-staker";

const sleepMs = 2000;

/**
 * How much the $ value of a buy/sell order must exceed to try to keep ordering.
 * Trying to buy/sell too small amounts causes errors.
 */
const orderThresholdUsd = 10;

export type FtxBotOrder = FtxAddOrderParams & {
  id: number;
  time: number;
};

export function getFtxMarketMaker(params: {
  subaccount: string;
  market: FtxMarket;
}) {
  const { market, subaccount } = params;
  const ftx = getFtxClient({ subaccount });
  const ftxUtil = getFtxUtil({ ftx, market });

  /**
   * Enters the market in the current price as a market maker.
   */
  async function enter(
    howMuch: () => Promise<{
      value: number;
      usdValue: number;
    }> = getFtxStaker(ftxUtil).howMuchCanBuy
  ) {
    return doAsMarketMaker(howMuch, addBestBid);
  }

  /**
   * Exits the market in the current price as a market maker.
   */
  async function exit(
    howMuch: () => Promise<{
      value: number;
      usdValue: number;
    }> = getFtxStaker(ftxUtil).howMuchCanSell
  ) {
    return doAsMarketMaker(howMuch, addBestAsk);
  }

  async function doAsMarketMaker(
    howMuchCanBuyOrSell: () => Promise<{ value: number; usdValue: number }>,
    addBestOrderToOrderbook: (size: number) => Promise<FtxBotOrder>
  ) {
    let order: FtxBotOrder | undefined;
    while (true) {
      if (order) {
        await ftx.cancelOrder(order.id);
        console.log("order cancelled");
      }
      const { value, usdValue } = await howMuchCanBuyOrSell();
      if (usdValue < orderThresholdUsd) {
        // Can't buy/sell more.
        break;
      }
      try {
        order = await addBestOrderToOrderbook(value);
      } catch (e) {
        if (e.message.includes("Size too small")) {
          // Can't buy/sell more
          break;
        } else throw e;
      }
      await sleep(sleepMs);
    }
    return order;
  }

  async function addBestBid(size: number): Promise<FtxBotOrder> {
    const { bid } = await ftxUtil.getQuote();
    const price = toFixed(bid + 0.001, 3);
    return addOrder({ price, size, side: "buy" });
  }

  async function addBestAsk(size: number): Promise<FtxBotOrder> {
    const { ask } = await ftxUtil.getQuote();
    const price = toFixed(ask - 0.001, 3);
    return addOrder({ price, size, side: "sell" });
  }

  async function addOrder({
    price,
    size,
    side,
  }: {
    price: number;
    size: number;
    side: "buy" | "sell";
  }): Promise<FtxBotOrder> {
    const params: FtxAddOrderParams = {
      market,
      size,
      side,
      price,
      postOnly: true, // the order is cancelled if not market maker
      type: "limit",
    };
    const { id } = await ftx.addOrder(params);
    return { ...params, id, time: getCurrentTimestampInSeconds() };
  }

  return {
    enter,
    exit,
  };
}
