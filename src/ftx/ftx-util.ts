import { FtxAddOrderParams, FtxClient, FtxMarket } from "./ftx";
import { getCurrentTimestampInSeconds } from "../util";
import { FtxBotOrder } from "./market-maker-orders";
import { m } from "../functions/functions";

/**
 * How much the $ value of a buy/sell order must exceed to try to keep ordering.
 * Trying to buy/sell too small amounts causes errors.
 */
const orderThresholdUsd = 10;

export function getFtxUtil({
  ftx,
  market,
}: {
  ftx: FtxClient;
  market: FtxMarket;
}) {
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

  async function getTotalUsdValue(): Promise<number> {
    const allBalances = await ftx.getBalances();
    return m.sum(allBalances.map((b) => b.usdValue));
  }

  /**
   * This assumes that long positions were taken.
   */
  async function getRecentTradeProfits() {
    const fills = await ftx.getFills({ market, limit: 200 });

    // Subsequent buy and sell fills collected to a single buy or sell trade.
    const trades = fills.reduce<
      { side: "buy" | "sell"; size: number; avgPrice: number }[]
    >((acc, next) => {
      const prev = acc[acc.length - 1];
      if (!prev || prev.side !== next.side) {
        return [
          ...acc,
          {
            side: next.side,
            avgPrice: next.price,
            size: next.size,
          },
        ];
      }
      const size = prev.size + next.size;
      const avgPrice =
        (prev.size / size) * prev.avgPrice + (next.size / size) * next.price;
      return [
        ...acc.slice(0, acc.length - 1),
        { side: prev.side, avgPrice, size },
      ];
    }, []);

    const profits = trades
      .slice(
        trades[0].side === "buy" ? 1 : 0,
        m.last(trades).side === "sell" ? trades.length - 1 : trades.length
      )
      .reduce<number[]>((acc, next, index, arr) => {
        if (index % 2 === 0) {
          return acc;
        }
        const sell = arr[index - 1];
        const buy = next;

        if (buy.side !== "buy" || sell.side !== "sell") {
          throw Error("Expected buy and sell order");
        }

        const profit = (sell.avgPrice - buy.avgPrice) / buy.avgPrice;

        return [...acc, profit];
      }, []);

    return profits;
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
    getTotalUsdValue,
    getRecentTradeProfits,
  };
}

export type FtxUtil = ReturnType<typeof getFtxUtil>;
