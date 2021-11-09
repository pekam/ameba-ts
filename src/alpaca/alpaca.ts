import { AlpacaClient, AlpacaStream, Bar, GetBars } from "@master-chief/alpaca";
import { Candle } from "../core/types";
import { properties } from "../properties";
import { Moment, toJSDate, toTimestamp } from "../shared/time-util";

const credentials = {
  key: properties.alpaca_api_key,
  secret: properties.alpaca_s,
  paper: true,
};

const client = new AlpacaClient({
  credentials,
});

function getStream() {
  return new AlpacaStream({
    credentials,
    type: "market_data",
    source: "iex",
  });
}

export type AlpacaResolution = GetBars["timeframe"];

async function getCandles({
  symbol,
  from,
  to,
  resolution,
}: {
  symbol: string;
  from: Moment;
  to: Moment;
  resolution: AlpacaResolution;
}) {
  const response = await alpaca.client.getBars({
    start: toJSDate(from),
    end: toJSDate(to),
    symbol,
    timeframe: resolution,
  });
  if (response.next_page_token) {
    throw Error("Paging support not implemented yet.");
  }
  return response.bars.map(barToCandle);
}

function barToCandle(bar: Bar): Candle {
  return {
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v,
    time: toTimestamp(bar.t),
  };
}

export const alpaca = {
  client,
  getStream,
  getCandles,
  barToCandle,
};
