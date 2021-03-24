## Dev instructions

Add a file called `properties.json` in the project root.
To fetch stock and forex market data, set the API key for finnhub.io.
To work with ftx.com, you need to define API keys and secrets (with a twist) for the subaccounts
you want to use:

```json
{
  "finnhub_api_key": "your_key_here",
  "ftx": [{
    "subaccount": "foo",
    "api_key": "bar",
    "s": "baz",
    "peak": 100
  }]
}
```
(`peak` is the account's peak value,
optional property to trigger risk management)

Starting all the services:

```
sudo systemctl start mongod
npm run server
npm run client
```

MongoDB is used to cache data loaded from Finnhub.
The command to start it depends on the OS.
The web app is used to render candlestick charts.
