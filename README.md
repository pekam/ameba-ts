## Dev instructions

Add a file called `properties.json` in the project root, and set your API key for finnhub.io (to fetch stock and forex market data):

```json
{
  "finnhub_api_key": "your_key_here"
}
```

Starting all the services:

```
sudo systemctl start mongod
npm run server
npm run client
```

MongoDB is used to cache data loaded from Finnhub.
The command to start it depends on the OS.
The web app is used to render candlestick charts.
