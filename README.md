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

## Dev instructions

### Working with external APIs

Various parts of this project rely on external APIs to fetch market data
and execute trades:

- [Finnhub](https://finnhub.io/) to fetch stock and forex data
- [FTX](https://ftx.com/) for crypto data and trading
- [Alpaca](https://alpaca.markets/) for US stock data and trading

For these features to work, you must create accounts for these services and
provide API keys for this project in a file called `properties.json`
(which is git ignored) in the project root:

```json
{
  "finnhub_api_key": "your_key_here",
  "ftx": [
    {
      "subaccount": "foo",
      "api_key": "your_key_here",
      "secret": "your_key_here",
      "peak": 100
    }
  ],
  "ftx_data_subaccount": "foo",
  "alpaca_api_key": "your_key_here",
  "alpaca_secret": "your_key_here"
}
```

Note:

- FTX supports multiple subaccounts with separate account balances,
  margin settings etc. This is useful for running multiple bots simultaneously,
  or just to reduce the bot's buying power instead of having access to your
  full account balance.
- `peak` is the subaccount's peak value, a manually updated optional property used for risk management in FTX trading bots.
- `ftx_data_subaccount` specifies the name of a subaccount that can be used for fetching data.
  This removes the need to specify the subaccount's name when just fetching data
  instead of executing trades.

### Caching data in a local database

Some features use MongoDB to cache the fetched market data locally,
in a DB named as "trade".
For these features to work, you must have MongoDB installed and running
in the default port 27017.

Start command on Ubuntu:

```
sudo systemctl start mongod
```

### Web app

The project also includes a web app which is used for data visualization,
mainly for rendering candlestick charts. To start the backend service as well
as the frontend React app (located in `./webapp`), run the following commands:

```
npm run server
npm run client
```
