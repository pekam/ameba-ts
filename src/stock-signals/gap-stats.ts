import { Indicators } from "../core/indicators";
import { CandleSeries } from "../core/types";
import { MARKET_CAPS } from "../data/load-company-profiles";
import { m } from "../shared/functions";
import { getDailyStockSignals, reportSignalStats } from "./daily-stock-signals";

/*
1. Previous bar is strongly bullish
2. Next bar gaps down
-> Stats for the gapped bar's performance after open
*/

(async function () {
  const signals = await getDailyStockSignals({
    from: "2020-06-01",
    to: "2021-08-01",
    marketCapRange: m.combineRanges(MARKET_CAPS.large, MARKET_CAPS.mega),
    signalerProvider: () => {
      const ind = new Indicators({ atrPeriod: 10 });
      return (series: CandleSeries) => {
        ind.update(series);
        const atr = ind.get(m.get(series, -2))?.atr;
        if (!atr) {
          return false;
        }
        const candle = m.get(series, -2);
        const gapDown = candle.close - m.last(series).open;
        return (
          // Good volatility adjusted profit:
          candle.close - candle.open > 2 * atr &&
          // No big wick above:
          candle.high - candle.close < 0.3 * atr &&
          // Gap down, but not too big:
          gapDown > 0 &&
          gapDown < atr * 2
        );
      };
    },
  });

  // Referring to the last candle used in the signal,
  // because it's open price is needed to detect the gap:
  reportSignalStats(signals, [{ afterDays: 0, relativeTo: "currentOpen" }]);
})();
/*

1. LARGE + MEGA CAP

                   Arguments                    
  Market cap (M)        10000   -     Infinity  
  Time             2020-06-01   -   2021-08-01  
.-----------------------------------------------------------------------------------------.
|                                         Results                                         |
|-----------------------------------------------------------------------------------------|
| Days after signal |  Diff from  | Profitable | Avg profit | Median | Sample size (days) |
|-------------------|-------------|------------|------------|--------|--------------------|
|                 0 | Candle open | 61.70%     | +0.63%     | +1.01% |                 47 |
'-----------------------------------------------------------------------------------------'
.-----------------------------------------------------------------------------------------.
|                                  All (for comparison)                                   |
|-----------------------------------------------------------------------------------------|
| Days after signal |  Diff from  | Profitable | Avg profit | Median | Sample size (days) |
|-------------------|-------------|------------|------------|--------|--------------------|
|                 0 | Candle open | 54.58%     | +0.01%     | +0.10% |                295 |
'-----------------------------------------------------------------------------------------'

 2. MID CAP

                   Arguments                    
  Market cap (M)         2000   -        10000  
  Time             2020-06-01   -   2021-08-01  
.-----------------------------------------------------------------------------------------.
|                                         Results                                         |
|-----------------------------------------------------------------------------------------|
| Days after signal |  Diff from  | Profitable | Avg profit | Median | Sample size (days) |
|-------------------|-------------|------------|------------|--------|--------------------|
|                 0 | Candle open | 46.77%     | -0.04%     | -0.26% |                 62 |
'-----------------------------------------------------------------------------------------'
.-----------------------------------------------------------------------------------------.
|                                  All (for comparison)                                   |
|-----------------------------------------------------------------------------------------|
| Days after signal |  Diff from  | Profitable | Avg profit | Median | Sample size (days) |
|-------------------|-------------|------------|------------|--------|--------------------|
|                 0 | Candle open | 52.88%     | +0.01%     | +0.07% |                295 |
'-----------------------------------------------------------------------------------------'

*/
