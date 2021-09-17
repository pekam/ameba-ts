import { Indicators } from "../core/indicators";
import { MARKET_CAPS } from "../data/load-company-profiles";
import { m } from "../shared/functions";
import { PERIODS } from "../shared/time-util";
import { getDailyStockSignals, reportSignalStats } from "./daily-stock-signals";

/*
Pullback to the SMA after the upper Donchian channel has been broken.
*/

(async function () {
  const signals = await getDailyStockSignals({
    marketCapRange: m.combineRanges(MARKET_CAPS.large, MARKET_CAPS.mega),
    from: "2020-08-01",
    to: "2021-08-01",
    signalerProvider: () => {
      const ind = new Indicators({
        donchianChannelPeriod: 100,
        smaPeriod: 20,
        atrPeriod: 10,
      });
      let lastDonchianBreakout = -Infinity;
      let lastSmaTouch = -Infinity;

      return (series) => {
        const candle = m.last(series);
        const { donchianChannel, sma, atr } = ind.update(series);
        const prev = ind.get(series[series.length - 2])?.donchianChannel;
        if (!donchianChannel || !prev || !sma || !atr) {
          return false;
        }
        if (donchianChannel.upper > prev.upper) {
          lastDonchianBreakout = candle.time;
          return false;
        }
        if (candle.low < sma) {
          lastSmaTouch = candle.time;
        }
        const signal =
          candle.time - lastDonchianBreakout < PERIODS.day * 14 &&
          lastSmaTouch > lastDonchianBreakout &&
          candle.open < candle.close;

        if (signal) {
          // Reset
          lastDonchianBreakout = -Infinity;
          lastSmaTouch = -Infinity;
        }
        return signal;
      };
    },
  });

  // console.log(
  //   signals.map((s) => ({
  //     t: toDateString(s.time),
  //     s: s.stocks.map((ss) => ss.symbol),
  //   }))
  // );

  reportSignalStats(signals, [
    { afterDays: 1, relativeTo: "currentOpen" },
    { afterDays: 1, relativeTo: "signalClose" },
    { afterDays: 3, relativeTo: "signalClose" },
    { afterDays: 5, relativeTo: "signalClose" },
  ]);
})();

/*
                   Arguments                    
  Market cap (M)        10000   -     Infinity  
  Time             2020-08-01   -   2021-08-01  
.------------------------------------------------------------------------------------------.
|                                         Results                                          |
|------------------------------------------------------------------------------------------|
| Days after signal |  Diff from   | Profitable | Avg profit | Median | Sample size (days) |
|-------------------|--------------|------------|------------|--------|--------------------|
|                 1 | Candle open  | 51.82%     | -0.05%     | +0.02% |                137 |
|                 1 | Signal close | 54.74%     | +0.09%     | +0.07% |                137 |
|                 3 | Signal close | 57.04%     | +0.33%     | +0.41% |                135 |
|                 5 | Signal close | 61.94%     | +0.32%     | +0.57% |                134 |
'------------------------------------------------------------------------------------------'
.------------------------------------------------------------------------------------------.
|                                   All (for comparison)                                   |
|------------------------------------------------------------------------------------------|
| Days after signal |  Diff from   | Profitable | Avg profit | Median | Sample size (days) |
|-------------------|--------------|------------|------------|--------|--------------------|
|                 1 | Candle open  | 54.80%     | +0.01%     | +0.08% |                250 |
|                 1 | Signal close | 57.60%     | +0.14%     | +0.15% |                250 |
|                 3 | Signal close | 64.92%     | +0.42%     | +0.45% |                248 |
|                 5 | Signal close | 67.07%     | +0.69%     | +0.69% |                246 |
'------------------------------------------------------------------------------------------'

*/
