import { fromPairs, map, pipe } from "remeda";
import { Candle, SeriesMap } from "../core/types";
import { Moment, Timeframe } from "../time";
import { thenAll } from "../util/util";

/**
 * Function that fetches historical price data in candlestick (OHLCV) format.
 */
export type CandleDataProvider = (
  args: CandleDataProviderArgs
) => Promise<Candle[]>;

export interface CandleDataProviderArgs {
  symbol: string;
  from: Moment;
  to: Moment;
  timeframe: Timeframe;
}

/**
 * Fetches candle data for multiple symbols from the given data provider and
 * returns them in a dictionary.
 */
export async function getMultiCandles({
  symbols,
  dataProvider,
  from,
  to,
  timeframe,
}: Omit<CandleDataProviderArgs, "symbol"> & {
  dataProvider: CandleDataProvider;
  symbols: string[];
}): Promise<SeriesMap> {
  return pipe(
    symbols,
    map(async (symbol) => [
      symbol,
      await dataProvider({
        symbol,
        timeframe,
        from,
        to,
      }),
    ]),
    thenAll(fromPairs<Candle[]>)
  );
}
