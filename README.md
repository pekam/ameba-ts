## Backtest example

See [example.ts](src/example.ts) for an example of writing a trading strategy
and testing it with historical price data.

## Trading strategy architecture

### Powerful core

The backtester works with `FullTradingStrategy` function type. This strategy needs to take care of position
sizing and simultaneosly handle multiple tradable assets if provided. Writing a `FullTradingStrategy`
gives you the most control over the trading decisions, at the cost of complexity.

### Easy-to-use abstraction

Algo traders can often make a couple of simplifications to the trading process:

- Use the same trading patterns for any asset (if trading multiple assets)
- Decouple trading patterns from position sizing / risk management

By implementing a `TradingStrategy`, you can focus on trading one asset at a time based on technical analysis
without thinking about position sizes. In this case you need a separate `Staker` to handle position sizing,
but the provided `createStaker` function should cover the common use cases, such as
"I want to risk 1% of my account balance per trade." A `TradingStrategy` and a `Staker` can then be combined
into a `FullTradingStrategy` that can be backtested.
