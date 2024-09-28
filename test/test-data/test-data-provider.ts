import {
  Candle,
  CandleDataProvider,
  timeframeToPeriod,
  toTimestamp,
} from "../../src";

export const testDataProvider: CandleDataProvider = {
  name: "test-data-provider",
  getCandles: (args) => {
    const candles: Candle[] = [];
    let time = toTimestamp(args.from);
    let open = 2;
    while (time < toTimestamp(args.to)) {
      const close = open + 1;
      candles.push({
        time,
        open,
        close,
        high: open + 2,
        low: open - 1,
        volume: 10,
      });
      time = time + timeframeToPeriod(args.timeframe);
      open = close;
    }
    return Promise.resolve(candles);
  },
};
