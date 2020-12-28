import { getDataSet } from "../data/load-data-set";
import { getUrl } from "../util";
import { m } from "../functions/functions";

// const dataSetId = "bigday19";
const dataSetId = "makkara";

/**
 * How many candles before and after the candle is compared to
 * determine whether it's a swing high/low.
 */
const distanceToCompare = 4;

async function run() {
  const dataSet = await getDataSet(dataSetId);
  const companies = await Promise.all(
    dataSet.companies.map((c) => c.withCandleSeries())
  );
  const params = companies.slice(200, 220).map((company) => {
    const candles = company.candles;
    const swingHighs = m.getSwingHighs(candles, distanceToCompare);
    const swingLows = m.getSwingLows(candles, distanceToCompare);

    return {
      symbol: company.symbol,
      markersAbove: swingHighs,
      markersBelow: swingLows,
    };
  });

  const url = getUrl(dataSetId, params);
  console.log(url);
}

run();
