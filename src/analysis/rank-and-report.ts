import { CompanyWithAsyncCandles, getDataSet } from "../data/load-data-set";

/**
 * Loads the data set from the database, runs the scoring function
 * for each candle series and prints the top scores/companies.
 *
 * Also, generates a link for viewing the candle chart of the top candidates,
 * which requires the webapp to be running in localhost.
 *
 * @param dataSetId
 * @param scoringFunction
 * @param reportCount the number of top-most results to include
 */
export async function rankAndReport(
  dataSetId: string,
  scoringFunction: (CandleSeries) => number,
  reportCount: number = 5
) {
  const dataSet = await getDataSet(dataSetId);
  const promises: Promise<{
    company: CompanyWithAsyncCandles;
    score: number;
  }>[] = dataSet.companies.map((company) => {
    return (async () => {
      const candleSeries = await company.getCandleSeries();
      const score = scoringFunction(candleSeries);
      return { company, score };
    })();
  });
  const results = await Promise.all(promises);
  results.sort((a, b) => b.score - a.score);

  const topResults = results.slice(0, reportCount).map((result) => ({
    symbol: result.company.symbol,
    name: result.company.name,
    score: result.score,
  }));

  console.log(topResults);

  const url = `http://localhost:3000/?dataSet=${dataSetId}&symbols=${topResults.map(
    (result) => result.symbol
  )}`;

  console.log(url);
}
