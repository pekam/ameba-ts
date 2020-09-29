import { CompanyProfile, getMidCapStocks } from "../data/load-company-profiles";
import { readDataFromFile } from "../data/data-caching";
import { CandleSeries } from "../core/candle-series";
import { findLowIndices } from "../strats/series-util";

const getSeriesFileName = (symbol: string) => `series.${symbol}.json`;

const scoreBySupport = (series: CandleSeries) => {
  const lowIndices = findLowIndices(series);
  if (lowIndices.length < 5) {
    console.log(series.length);
    return 99999;
  }
  const lowestLowCandles = lowIndices
    .slice(-5)
    .map((i) => series[i])
    .sort((a, b) => a.low - b.low);

  const lowestLow = lowestLowCandles[0].low;
  const lowDiffScore =
    lowestLowCandles.reduce(
      (acc, current) => acc + Math.abs(current.low - lowestLow),
      0
    ) / lowestLow;

  return lowDiffScore;
};

const stocks = getMidCapStocks()
  .map((stock) => ({
    stock,
    series: readDataFromFile(getSeriesFileName(stock.symbol)),
  }))
  .filter(({ stock, series }) => series);

console.log(stocks.length);

const scoreData: {
  stock: CompanyProfile;
  score: number;
}[] = getMidCapStocks()
  .map((stock) => ({
    stock,
    series: readDataFromFile(getSeriesFileName(stock.symbol)),
  }))
  .filter(({ stock, series }) => series)
  .map(({ stock, series }) => ({ stock, score: scoreBySupport(series) }));

const sorted = scoreData.sort((a, b) => a.score - b.score);

console.log(sorted.slice(0, 5));
