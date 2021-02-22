import { FtxAddOrderParams, FtxClient, FtxMarket } from "./ftx";
import { getCurrentTimestampInSeconds, sleep, toFixed } from "../util";

const sleepMs = 2000;

export type FtxBotOrder = FtxAddOrderParams & {
  id: number;
  time: number;
};

export function getFtxMarketMaker(ftx: FtxClient, market: FtxMarket) {
  /**
   * Enters the market in the current price as a market maker.
   */
  async function enter() {
    console.log("begin entry");
    const order = await doAsMarketMaker(howMuchCanBuy, addBestBid);
    console.log(order ? "entry finished" : "already entered");
    return order;
  }

  /**
   * Exits the market in the current price as a market maker.
   */
  async function exit() {
    console.log("begin exit");
    const order = await doAsMarketMaker(howMuchCanSell, addBestAsk);
    console.log(order ? "exit finished" : "already exited");
    return order;
  }

  async function doAsMarketMaker(
    howMuchCanBuyOrSell: () => Promise<number>,
    addBestOrderToOrderbook: (size: number) => Promise<FtxBotOrder>
  ) {
    let order: FtxBotOrder;
    while (true) {
      if (order) {
        await ftx.cancelOrder(order.id);
        console.log("order cancelled");
      }
      const much = await howMuchCanBuyOrSell();
      if (much < 0.0001) {
        break;
      }
      order = await addBestOrderToOrderbook(much);
      await sleep(sleepMs);
    }
    return order;
  }

  async function addBestBid(size: number): Promise<FtxBotOrder> {
    const orderBook = await ftx.getOrderBook({ market, depth: 1 });
    const bid = orderBook.bids[0].price;
    const price = toFixed(bid + 0.001, 3);
    return addOrder({ price, size, side: "buy" });
  }

  async function addBestAsk(size: number): Promise<FtxBotOrder> {
    const orderBook = await ftx.getOrderBook({ market, depth: 1 });
    const ask = orderBook.asks[0].price;
    const price = toFixed(ask - 0.001, 3);
    return addOrder({ price, size, side: "sell" });
  }

  async function howMuchCanBuy() {
    const { usd, bid } = await getState();
    return usd / bid;
  }

  async function howMuchCanSell() {
    return (await getBalancesAsObject()).coin;
  }

  async function getState() {
    const [{ usd, coin }, orderBook] = await Promise.all([
      getBalancesAsObject(),
      ftx.getOrderBook({ market, depth: 1 }),
    ]);

    const ask = orderBook.asks[0].price;
    const bid = orderBook.bids[0].price;

    return { usd, coin, ask, bid };
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

  async function getBalancesAsObject() {
    const balances = await ftx.getBalances();
    const usdBalance = balances.find((b) => b.coin === "USD");
    const coinBalance = balances.find((b) => b.coin === market.split("/")[0]);

    const usd = usdBalance ? usdBalance.free : 0;
    const coin = coinBalance ? coinBalance.free : 0;

    return { usd, coin };
  }

  return {
    enter,
    exit,
  };
}
