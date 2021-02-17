import { ftx, FtxMarket } from "./ftx";
import { sleep, toFixed } from "../util";

const market: FtxMarket = "BTC/USD";

const sleepMs = 2000;

/**
 * Enters the market in the current price as a market maker.
 */
export async function enterAsMarketMaker() {
  console.log("begin entry");
  let id;
  while (true) {
    if (id) {
      await ftx.cancelOrder(id);
      console.log("order cancelled");
    }
    const much = await howMuchCanBuy();
    if (much < 0.0001) {
      break;
    }
    id = await addBestBid(much);
    await sleep(sleepMs);
  }
  const didSomething = !!id;
  console.log(didSomething ? "entry finished" : "already entered");
}

/**
 * Exits the market in the current price as a market maker.
 */
export async function exitAsMarketMaker() {
  console.log("begin exit");
  let id;
  while (true) {
    if (id) {
      await ftx.cancelOrder(id);
      console.log("order cancelled");
    }
    const much = await howMuchCanSell();
    if (much < 0.0001) {
      break;
    }
    id = await addBestAsk(much);
    await sleep(sleepMs);
  }
  const didSomething = !!id;
  console.log(didSomething ? "exit finished" : "already exited");
}

async function addBestBid(size: number): Promise<number> {
  const orderBook = await ftx.getOrderBook({ market, depth: 1 });
  const bid = orderBook.bids[0].price;
  const price = toFixed(bid + 0.001, 3);
  return order({ price, size, side: "buy" });
}

async function addBestAsk(size: number): Promise<number> {
  const orderBook = await ftx.getOrderBook({ market, depth: 1 });
  const ask = orderBook.asks[0].price;
  const price = toFixed(ask - 0.001, 3);
  return order({ price, size, side: "sell" });
}

async function howMuchCanBuy() {
  const { usd, bid } = await getState();
  return usd / bid;
}

async function howMuchCanSell() {
  return (await getBalancesAsObject()).btc;
}

async function getState() {
  const [{ usd, btc }, orderBook] = await Promise.all([
    getBalancesAsObject(),
    ftx.getOrderBook({ market, depth: 1 }),
  ]);

  const ask = orderBook.asks[0].price;
  const bid = orderBook.bids[0].price;

  return { usd, btc, ask, bid };
}

async function order({
  price,
  size,
  side,
}: {
  price: number;
  size: number;
  side: "buy" | "sell";
}): Promise<number> {
  const { id } = await ftx.addOrder({
    market,
    size,
    side,
    price,
    postOnly: true,
    type: "limit",
  });
  return id;
}

async function getBalancesAsObject() {
  const balances = await ftx.getBalances();
  const usdBalance = balances.find((b) => b.coin === "USD");
  const btcBalance = balances.find((b) => b.coin === "BTC");

  const usd = usdBalance ? usdBalance.free : 0;
  const btc = btcBalance ? btcBalance.free : 0;

  return { usd, btc };
}
