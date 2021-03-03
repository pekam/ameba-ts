import { FtxAddOrderParams, FtxMarket, getFtxClient } from "./ftx";
import { getCurrentTimestampInSeconds } from "../util";
import { FtxBotOrder } from "./market-maker-orders";

/**
 * How much the $ value of a buy/sell order must exceed to try to keep ordering.
 * Trying to buy/sell too small amounts causes errors.
 */
const orderThresholdUsd = 10;

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

    const usd = usdBalance ? usdBalance.total : 0;
    const coin = coinBalance ? coinBalance.total : 0;

    return { usd, coin };
  }

  async function getQuote() {
    const orderBook = await ftx.getOrderBook({ market, depth: 1 });
    const bid = orderBook.bids[0].price;
    const ask = orderBook.asks[0].price;
    return { bid, ask };
  }

  async function getState() {
    const [account, balances, quote] = await Promise.all([
      ftx.getAccount(),
      getBalancesAsObject(),
      getQuote(),
    ]);
    return { ...account, ...balances, ...quote };
  }

  async function howMuchCanBuy() {
    const {
      spotMarginEnabled,
      usd,
      coin,
      bid,
      collateral,
      leverage,
    } = await getState();

    if (!spotMarginEnabled) {
      return { value: usd / bid, usdValue: usd, price: bid };
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
      collateral,
      leverage,
    } = await getState();

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

  async function enterWithMarketOrder() {
    return doMarketOrder(howMuchCanBuy, "buy");
  }

  async function exitWithMarketOrder(): Promise<FtxBotOrder> {
    return doMarketOrder(howMuchCanSell, "sell");
  }

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
      market,
      side,
      price: 0,
    };
    const { id } = await ftx.addOrder(params);
    return { ...params, id, price, time: getCurrentTimestampInSeconds() };
  }

  return {
    ftx,
    getBalancesAsObject,
    getQuote,
    getState,
    howMuchCanBuy,
    howMuchCanSell,
    enterWithMarketOrder,
    exitWithMarketOrder,
  };
}

export type FtxUtil = ReturnType<typeof getFtxUtil>;
