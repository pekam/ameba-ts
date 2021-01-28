import { CompanyWithAsyncCandles, getDataSet } from "../data/load-data-set";
import { getUrl } from "../util";
import { Candle } from "../core/types";
import { m } from "../functions/functions";
import _ = require("lodash");

/**
 * Loads the data set from the database, runs the scoring function
 * for each candle series and prints the top scores/companies.
 *
 * Also, generates a link for viewing the candle chart of the top candidates,
 * which requires the webapp to be running in localhost.
 *
 * NOTE: ignores the last candle in the series because it is often not complete
 * NOTE: includes only positive results
 *
 * @param dataSetId
 * @param scoringFunction
 * @param reportCount the number of top-most results to include
 * @param repeatFromEnd how many times to repeat the scoring function by taking
 * subseries from the end with one candle less each time. Only the best score of
 * these subseries is then reported for each candle series.
 */
export async function rankAndReport(
  dataSetId: string,
  scoringFunction: (CandleSeries) => number,
  reportCount: number = 5,
  repeatFromEnd: number = 1
) {
  const dataSet = await getDataSet(dataSetId);
  const promises: Promise<{
    company: CompanyWithAsyncCandles;
    score: number;
    candle: Candle;
  }>[] = dataSet.companies.map((company) => {
    return (async () => {
      const candleSeries = await company.getCandleSeries();

      const resultsForSeries = m
        .range(repeatFromEnd)
        // Remove -1 below to include the last candle as well
        .map((i) => candleSeries.slice(0, candleSeries.length - i - 1))
        .map((subSeries) => {
          const score = scoringFunction(subSeries);
          return { company, score, candle: m.last(subSeries) };
        });

      const bestResultForSeries = m.sortDescending(
        resultsForSeries,
        (r) => r.score
      )[0];
      return bestResultForSeries;
    })();
  });

  const sortedResults = m.sortDescending(
    await Promise.all(promises),
    (r) => r.score
  );

  const topResults = sortedResults
    .slice(0, reportCount)
    .filter((result) => result.score > 0) // Only positive scores reported
    .map((result) => ({
      symbol: result.company.symbol,
      name: result.company.name,
      score: result.score,
      candle: result.candle,
    }));

  console.log(topResults.map((res) => _.omit(res, "candle")));

  const url = getUrl(
    dataSetId,
    topResults.map((result) => ({
      symbol: result.symbol,
      markersAbove: [result.candle],
      markersBelow: [],
    }))
  );

  console.log(url);
}