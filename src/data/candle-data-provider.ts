import { fromPairs, map, pipe } from "remeda";
import { Candle, SeriesMap } from "../core/types";
import { Moment, Timeframe } from "../time";
import { thenAll } from "../util/util";

/**
 * Fetches historical price data, e.g. from a broker's API or from a local data
 * set.
 */
export interface CandleDataProvider {
  /**
   * Name is used to distinguish data providers from each other. This can be the
   * name of the broker whose API is used to fetch the data.
   *
   * Note that the name only needs to identify the original source of the data.
   * For example, if you have a data provider that fetches candles from the API
   * of broker X, and another data provider that simply adds local caching on
   * top of that, you can use the same name (e.g. "broker-x") for both of them.
   *
   * The purpose is to add global uniqueness for assets. For example, if data
   * for symbol "FOO" is requested, we need to know the broker where it is
   * listed. It might be a crypto currency listed in a crypto exchange X, or a
   * stock in the US stock market accessed via stock broker Y.
   */
  name: string;
  /**
   * Function that fetches historical price data in candlestick (OHLCV) format.
   */
  getCandles: GetCandles;
}

/**
 * Function that fetches historical price data in candlestick (OHLCV) format.
 */
export type GetCandles = (args: GetCandlesArgs) => Promise<Candle[]>;

export interface GetCandlesArgs {
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
}: Omit<GetCandlesArgs, "symbol"> & {
  dataProvider: CandleDataProvider;
  symbols: string[];
}): Promise<SeriesMap> {
  return pipe(
    symbols,
    map(async (symbol) => [
      symbol,
      await dataProvider.getCandles({
        symbol,
        timeframe,
        from,
        to,
      }),
    ]),
    thenAll(fromPairs<Candle[]>)
  );
}
