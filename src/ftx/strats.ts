import { Candle, CandleSeries, Strategy, TradeState } from "../core/types";
import { m } from "../shared/functions";
import { indicators } from "../shared/indicators";
import { FtxBotStrat } from "./bot";
import { FtxBotOrder } from "./market-maker-orders";

export const emaStrat = getEmaStrat(5, 20);

export function getEmaStrat(shortEmaPeriod: number, longEmaPeriod: number) {
  return function ({
    series,
    lastOrder,
  }: {
    series: CandleSeries;
    lastOrder: FtxBotOrder;
  }) {
    const emaShort = getEma(series, shortEmaPeriod);
    const emaLong = getEma(series, longEmaPeriod);
    // console.log({
    //   emaShort,
    //   emaLong,
    // });

    const longCondition = emaShort > emaLong;

    return longCondition;
  };
}

/**
 * Uses crossover of longer EMAs to ride the trends, unless the last crossover
 * has happened recently. In that case, uses crossover of shorter EMAs, as mean
 * reversion is likely.
 */
export function tripleEmaStrat({
  series,
  lastOrder,
}: {
  series: CandleSeries;
  lastOrder: FtxBotOrder;
}) {
  const lookback = 10;

  const emaTiny = getEmas(series, 2, lookback);
  const emaShort = getEmas(series, 5, lookback);
  const emaLong = getEmas(series, 20, lookback);

  const longCondition = m.last(emaShort) > m.last(emaLong);
  const tinyLongCondition = m.last(emaTiny) > m.last(emaShort);

  const recentlyCrossed = m
    .range(emaShort.length)
    .some((i) => emaShort[i] > emaLong[i] !== longCondition);

  // console.log({
  //   longCondition,
  //   tinyLongCondition,
  //   recentlyCrossed,
  // });

  if (recentlyCrossed) {
    return tinyLongCondition;
  } else {
    const conflictingSignals = longCondition !== tinyLongCondition;
    if (conflictingSignals) {
      const currentlyLong = lastOrder && lastOrder.side === "buy";
      return currentlyLong;
    }
    return longCondition;
  }
}

function getEma(series: CandleSeries, period: number) {
  return m.last(getEmas(series, period, 1));
}

function getEmas(series: CandleSeries, period: number, limit: number) {
  return indicators.ema(series.slice(-200), period).values.slice(-limit);
}

/**
 * NOTE: Be careful if the the strat uses lastOrder, as it is not perfectly mocked.
 */
export function getBacktestableStrategy(
  ftxStrat: FtxBotStrat,
  shortingEnabled: boolean = false
): Strategy {
  let lastOrder: FtxBotOrder | undefined = undefined;

  const updateLastOrder = (lastCandle: Candle, side: "buy" | "sell") => {
    lastOrder = {
      price: lastCandle.close,
      side,
      time: lastCandle.time,
      id: 0,
      size: 1,
    };
  };

  return {
    init(tradeState: TradeState): void {},
    update(state: TradeState) {
      const series = state.series;
      const last = m.last(series);

      const shouldBeLong = ftxStrat({ series, lastOrder });

      if (!state.position) {
        if (shouldBeLong) {
          updateLastOrder(last, "buy");
          return {
            entryOrder: {
              price: last.close * 1.1,
              type: "limit",
              side: "buy",
            },
          };
        } else {
          updateLastOrder(last, "sell");
          return {
            entryOrder: shortingEnabled
              ? {
                  side: "sell",
                  price: last.close * 0.9,
                  type: "limit",
                }
              : null,
          };
        }
      }

      if (state.position === "long" && !shouldBeLong) {
        updateLastOrder(last, "sell");
        return { takeProfit: last.close * 0.9 };
      }

      if (state.position === "short" && shouldBeLong) {
        updateLastOrder(last, "buy");
        return { takeProfit: last.close * 1.1 };
      }
      return {};
    },
  };
}
