import {
  AssetState,
  backtest,
  Candle,
  CandleDataProvider,
  createStaker,
  getSma,
  TradingStrategy,
  withStaker,
} from "./";

/*
  TODO: Update to use composeStrategy as that is the recommended method for
  writing strategies.
*/

/**
 * A strategy that buys the breakout of previous candle's high if the price is
 * above the 50-period simple moving average (SMA), aims to take a 5% profit and
 * has a stop loss that trails 1% below the price.
 */
const exampleStrategy: TradingStrategy = (state: AssetState) => {
  const sma = getSma(state, 50);
  const newCandle = state.series[state.series.length - 1];

  if (!sma) {
    return { entryOrder: null };
  }

  if (!state.position) {
    // No position at this point, so we need to decide if we want to enter or
    // not (potentially cancelling an active entry order)

    const entryPrice = newCandle.high;

    // Enter only above the moving average
    if (entryPrice < sma) {
      return { entryOrder: null };
    }

    return {
      // Enter if breaking previous candle's high
      entryOrder: {
        side: "buy",
        type: "stop",
        price: entryPrice,
      },
      stopLoss: entryPrice * 0.99,
      takeProfit: entryPrice * 1.05,
    };
  } else {
    // Manage the current position by updating exit order(s)
    return {
      // Trailing 1% stop loss
      stopLoss: Math.max(state.stopLoss || 0, newCandle.high * 0.99),
    };
  }
};

const dataProvider: CandleDataProvider = {
  name: "some-broker-name",
  getCandles: async ({ symbol, timeframe, from, to }): Promise<Candle[]> => {
    // You need to implement a data provider e.g. by fetching from your broker's
    // API or by using your local data.
    throw Error("Not implemented.");
  },
};

// Backtest the example strategy with BTC and ETH hourly data between January
// and December 2021.
(async () => {
  const result = await backtest({
    strategy: withStaker(
      exampleStrategy,
      // Staker handles position sizing/risk management
      createStaker({
        maxRelativeRisk: 0.01, // Risk 1% of account per trade
        maxRelativeExposure: 1.5, // Use max 50% leverage
        allowFractions: true, // Cryptos allow non-whole-number position sizes
      })
    ),
    dataProvider,
    symbols: ["BTC", "ETH"],
    timeframe: "1h",
    from: "2021-01-01",
    to: "2021-12-01",
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
  and slippage (can be simulated with commissionProvider) for 2183 trades
  could turn this result negative.
  */
})();
