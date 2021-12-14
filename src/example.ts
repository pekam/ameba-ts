import { backtest } from "./core/backtest";
import { Indicators } from "./core/indicators";
import { createStaker, TradingStrategy, withStaker } from "./core/staker";
import { AssetState } from "./core/types";
import { ftxDataStore } from "./ftx/ftx-data-store";

/**
 * Creates a strategy that buys the breakout of previous candle's high if the
 * price is above a simple moving average (SMA), aims to take a 5% profit and
 * has a stop loss that trails 1% below the price.
 *
 * @param smaPeriod the period to use for the moving average
 */
function exampleStrategy(smaPeriod: number): TradingStrategy {
  // Calculating indicator values can be really time consuming, unless storing
  // the previous values in a closure. Unfortunately this makes the strategy
  // function stateful.
  const indicators = new Indicators({ smaPeriod });

  return (state: AssetState) => {
    const { sma } = indicators.update(state.series);
    const newCandle = state.series[state.series.length - 1];

    if (!sma) {
      return { entryOrder: null };
    }

    if (!state.position) {
      const entryPrice = newCandle.high;
      // Enter only above the moving average
      if (entryPrice < sma) {
        return { entryOrder: null };
      }

      return {
        entryOrder: {
          side: "buy",
          type: "stop",
          price: entryPrice,
        },
        stopLoss: entryPrice * 0.99,
        takeProfit: entryPrice * 1.05,
      };
    } else {
      // Manage the current position
      return {
        // Trailing 1% stop loss
        stopLoss: Math.max(state.stopLoss || 0, newCandle.high * 0.99),
      };
    }
  };
}

/**
 * Returns hourly candlestick data for BTC and ETH cryptos.
 */
async function getCryptoSeries() {
  // Note that ftxDataStore requires FTX API keys in properties.json and MongoDB
  // to be running, as explained in README.
  return {
    BTC: await ftxDataStore.getCandles({
      market: "BTC/USD",
      startDate: "2021-01-01",
      endDate: "2021-12-01",
      resolution: "1h",
    }),
    ETH: await ftxDataStore.getCandles({
      market: "ETH/USD",
      startDate: "2021-01-01",
      endDate: "2021-12-01",
      resolution: "1h",
    }),
  };
}

// Backtest the example strategy with the crypto data
(async () => {
  const result = backtest({
    strategy: withStaker(
      () => exampleStrategy(50),
      // Staker handles position sizing/risk management
      createStaker({
        maxRelativeRisk: 0.01, // Risk 1% of account per trade
        maxRelativeExposure: 1.5, // Use max 50% leverage
        allowFractions: true, // Cryptos allow non-whole-number position sizes
      })
    ),
    series: await getCryptoSeries(),
  });

  console.log(result.stats);
  /*
  {
    initialBalance: 10000,
    endBalance: 32161.101496586634,
    relativeProfit: 2.2161101496586633,
    tradeCount: 2183,
    successRate: 0.37792029317453046,
    buyAndHoldProfit: 3.1247092452187273,
    range: { from: 1609459200, to: 1638313200 }
  }

  222% profit looks awesome, until comparing to the buy-and-hold profit,
  which is 312% on average for these two cryptos. Also, transaction costs
  and slippage (to be implemented) for 2183 trades could very well turn
  this result negative.
  */
})();
