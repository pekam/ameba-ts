import { CandleSeries } from "../core/candle-series";
import { rankAndReport } from "./rank-and-report";
import { getDonchianChannel } from "../core/indicators";

const donchianChannelPeriod = 20;
const numOfPeriods = 10;

const scoreByTradingRange = (series: CandleSeries) => {
  const donchianChannels = new Array(numOfPeriods).fill(null).map((_, i) => {
    const end = series.length - i * donchianChannelPeriod;
    const subSeries = series.slice(0, end);

    return getDonchianChannel(subSeries, donchianChannelPeriod);
  });

  const lowestUpper = Math.min(...donchianChannels.map((c) => c.upper));
  const highestLower = Math.max(...donchianChannels.map((c) => c.lower));

  const score = (lowestUpper - highestLower) / highestLower;

  return score;
};

rankAndReport("makkara", scoreByTradingRange, 20);
