# Ameba-TS

Ameba-TS is a multi-asset backtester for TypeScript.

## Getting started

### Creating a trading strategy

The easiest way of writing a trading strategy is composing it from reusable
building blocks ("strategy components") with `composeStrategy`. You can provide
a set of entry filters (conditions which need to pass before a trade can be
entered), the method to enter trades, and one or many methods to exit the trade.

In the following example, a long position is entered with a market order when
the 50-period SMA (simple moving average) is above the 200-period SMA and the
20-period RSI (relative strength index) indicator is below 30. Both the stop
loss and take profit order are place 5 times the 20-period ATR (average true
range) away from the entry price, so the trades have 1-to-1 risk-to-reward
ratio.

<!-- prettier-ignore -->
```ts
const myStrategy: TradingStrategy = composeStrategy({
  filters: [
    gt(sma(50), sma(200)),
    lt(rsi(20), 30)
  ],
  entry: marketBuyEntry,
  exits: [
    atrStopLoss(20, 5),
    atrTakeProfit(20, 5)
  ],
});
```

### Position sizing

To decide how many units to buy when entering a position (or sell when
shorting), we need to create a position sizing strategy, a `Staker`. For common
use cases this can be achieved as follows:

```ts
const myStaker: Staker = createStaker({
  maxRelativeRisk: 0.01, // Risk 1% of account per trade
  maxRelativeExposure: 1.5, // Use max 50% leverage for all positions in total
  allowFractions: true, // Currencies and cryptos allow non-whole-number position sizes, stocks don't
});
```

### Providing data for the backtest

In order to test the strategy with historical price data, you need to implement
a data provider:

```ts
const myDataProvider: CandleDataProvider = {
  name: "broker-name",
  getCandles: async ({ symbol, timeframe, from, to }): Promise<Candle[]> => {
    throw Error("Not implemented.");
  },
};
```

You can implement the `getCandles` function e.g. by fetching from your broker's
API or by reading from your locally stored data set.

### Backtesting

Below is an example of testing how the strategy would have performed during the
year 2021 when trading BTC and ETH cryptocurrencies (the symbols are specific to
the data provider).

```ts
const result: BacktestResult = await backtest({
  strategy: withStaker(myStrategy, myStaker),
  dataProvider: myDataProvider,
  initialBalance: 10000,
  symbols: ["BTC", "ETH"],
  timeframe: "1h",
  from: "2021-01-01",
  to: "2022-01-01",
});

console.log(result.stats);
```

The result tells us how much profit the strategy would have made, among other
statistics. You can obtain all of the executed trades in `result.trades`.

NOTE: The asynchronous `backtest` function loads price data on demand in batches
and clears old data from memory. To keep your code synchronous, you also have
the option to load the used data set into memory beforehand and use the
`backtestSync` function instead.

## Trading strategy architecture

A trading strategy is a function that receives the current state of things and
returns the changes it wishes to make to the open orders. The state includes
e.g. the historical price data up to the current moment as `Candles` (OHLC data)
and the currently active positions and orders. The strategy function is called
each time when a new candle is completed, and the changes returned by the
strategy are activated by closing previous orders and/or opening new ones.

There are three layers of abstraction.

### 1. Using `composeStrategy` with a `Staker`

This allows you to focus on high level trading ideas and decouple trading
patterns from position sizing. See the 'Getting started' guide for an example.

Using `composeStrategy` enables easily experimenting with different kinds of
strategy components. Changes such as adding a new entry filter or changing the
entry method to limit order at the recent lows require changing only one line of
code. Also, if you create your custom strategy component, you can reuse it in
multiple strategies without repeating yourself.

### 2. Writing a `TradingStrategy` function

You can also write out a `TradingStrategy` function without utilizing
`composeStrategy`. You can still focus on one asset at a time and decouple
position sizing from trading patterns by using a `Staker`, but the code is more
verbose and harder to maintain.

Below is an example of writing out the same strategy as composed in the 'Getting
started' guide:

```ts
const myStrategy: TradingStrategy = (state: AssetState) => {
  const fastSma = getSma(state, 50);
  const slowSma = getSma(state, 200);
  const rsi = getRsi(state, 20);
  const atr = getAtr(state, 20);
  if (
    fastSma === undefined ||
    slowSma === undefined ||
    rsi === undefined ||
    atr === undefined
  ) {
    // More data needed before the indicators are ready
    return {};
  }
  if (!state.position) {
    if (fastSma > slowSma && rsi < 30) {
      // Not in a position and entry conditions fulfilled
      const currentPrice = state.series[state.series.length - 1].close;
      return {
        entryOrder: {
          side: "buy",
          type: "market",
        },
        // Exit orders set while not in a position will be posted immediately
        // if/when the entry is filled
        stopLoss: currentPrice - atr * 5,
        takeProfit: currentPrice + atr * 5,
      };
    } else {
      // Cancel potentially open entry order (although not really meaningful
      // when the entry is a market order that should fill immediately)
      return {
        entryOrder: null,
      };
    }
  } else {
    // Here we could manage the exit orders while in a position
    return {};
  }
};
```

### 3. `FullTradingStrategy`

The backtester actually takes in a `FullTradingStrategy` function type
(`withStaker` returns `FullTradingStrategy`). This is the lowest level of
abstraction among the trading strategy APIs. If writing out a
`FullTradingStrategy`, you need to take care of position sizing and
simultaneosly handle multiple tradable assets (if provided). This gives you the
most control over the trading decisions, at the cost of complexity.
