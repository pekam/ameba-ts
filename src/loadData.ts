import * as fs from "fs";
import fetch from "node-fetch";
import * as path from "path";

const { finnhub_api_key } = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'properties.json'), 'utf8'));

interface CandleRequest {
  symbol: string,
  resolution: string,
  from: Date,
  to: Date
}

interface Candle {
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number,
  time: Date
}

interface FinnhubCandleResponse {
  o: Array<number>,
  h: Array<number>,
  l: Array<number>,
  c: Array<number>,
  v: Array<number>,
  t: Array<number>,
  s: string
}

function loadForexCandles(options: CandleRequest): Promise<void | Candle[]> {

  console.log('\nFetching data with params:\n' + JSON.stringify(options));

  if (!finnhub_api_key) {
    throw new Error('Failed to read finnhub_api_key from properties.json');
  }

  const url: string = `https://finnhub.io/api/v1/forex/candle?` +
    `symbol=${options.symbol}&` +
    `resolution=${options.resolution}&` +
    `from=${Math.floor(options.from.getTime() / 1000)}&` +
    `to=${Math.floor(options.to.getTime() / 1000)}&` +
    `token=${finnhub_api_key}`

  console.log('Fetching from url:\n' + url)

  return fetch(url)

    .then(res => {
      if (!res.ok) {
        throw new Error(`Failed to fetch data: ${res.status} ${res.statusText}`)
      }
      return res.json();
    })

    .then(json => {
      const data: FinnhubCandleResponse = json;
      const length = data.o.length;

      if (!(data.h.length === length
        && data.l.length === length
        && data.c.length === length
        && data.v.length === length
        && data.t.length === length)) {
        throw new Error('Invalid data. Candlestick property lists have unequal lengths.');
      }

      const candles: Candle[] = data.o.map((_, index) => ({
        open: data.o[index],
        high: data.h[index],
        low: data.l[index],
        close: data.c[index],
        volume: data.v[index],
        time: new Date(data.t[index] * 1000)
      }));

      return candles;
    })

    .catch(err => {
      console.error('Failed to load or parse forex candles:\n', err)
    })
}

export {
  loadForexCandles,
  Candle,
  CandleRequest
}
