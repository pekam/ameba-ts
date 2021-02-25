import { FtxMarket, getFtxClient } from "./ftx";

export function getFtxUtil({
  subaccount,
  market,
}: {
  subaccount: string;
  market: FtxMarket;
}) {
  const ftx = getFtxClient({ subaccount });

  async function getBalancesAsObject() {
    const balances = await ftx.getBalances();
    const usdBalance = balances.find((b) => b.coin === "USD");
    const coinBalance = balances.find((b) => b.coin === market.split("/")[0]);

    const usd = usdBalance ? usdBalance.free : 0;
    const coin = coinBalance ? coinBalance.free : 0;

    return { usd, coin };
  }

  async function getQuote() {
    const orderBook = await ftx.getOrderBook({ market, depth: 1 });
    const bid = orderBook.bids[0].price;
    const ask = orderBook.asks[0].price;
    return { bid, ask };
  }

  async function getState() {
    const [balances, quote] = await Promise.all([
      getBalancesAsObject(),
      getQuote(),
    ]);
    return { ...balances, ...quote };
  }

  async function howMuchCanBuy() {
    const { usd, bid } = await getState();
    return { value: usd / bid, usdValue: usd };
  }

  async function howMuchCanSell() {
    const { coin, ask } = await getState();
    return { value: coin, usdValue: coin * ask };
  }

  return {
    ftx,
    getBalancesAsObject,
    getQuote,
    getState,
    howMuchCanBuy,
    howMuchCanSell,
  };
}
