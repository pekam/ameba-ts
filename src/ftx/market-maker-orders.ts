import { FtxAddOrderParams, FtxMarket } from "./ftx";
import { getCurrentTimestampInSeconds, sleep, toFixed } from "../util";
import { getFtxUtil } from "./ftx-util";

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
  const { market } = params;
  const ftxUtil = getFtxUtil(params);
  const ftx = ftxUtil.ftx;

  /**
   * Enters the market in the current price as a market maker.
   */
  async function enter() {
    console.log("begin entry");
    const order = await doAsMarketMaker(ftxUtil.howMuchCanBuy, addBestBid);
    console.log(order ? "entry finished" : "already entered");
    return order;
  }

  /**
   * Exits the market in the current price as a market maker.
   */
  async function exit() {
    console.log("begin exit");
    const order = await doAsMarketMaker(ftxUtil.howMuchCanSell, addBestAsk);
    console.log(order ? "exit finished" : "already exited");
    return order;
  }

  async function doAsMarketMaker(
    howMuchCanBuyOrSell: () => Promise<{ value: number; usdValue: number }>,
    addBestOrderToOrderbook: (size: number) => Promise<FtxBotOrder>
  ) {
    let order: FtxBotOrder;
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
