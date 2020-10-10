import { CompanyProfile, getStocksByMarketCap } from "./load-company-profiles";
import { loadCandles, Resolution } from "./load-candle-data";
import { db } from "./mongo";
import { timestampFromUTC } from "../core/date-util";
import { CandleSeries } from "../core/candle-series";

const collection = "data-sets";

const getCandleCollection = (dataSetId: string) => "candlesFor-" + dataSetId;
/**
 * A data set contains a list of companies with price candles, loaded
 * with the same set of parameters (candle time frame, start and end time).
 */
export interface DataSet {
  _id: string;
  description: string;
  resolution: Resolution;
  from: number;
  to: number;
  companies: CompanyWithCandles[];
}

export interface CompanyWithCandles extends CompanyProfile {
  getCandleSeries: () => Promise<CandleSeries>;
}

/**
 * Loads the data set with the given id from the database.
 */
export async function getDataSet(id: string): Promise<DataSet> {
  const dataSet = await db.get(collection, id);

  dataSet.companies.forEach((company) => {
    company.getCandleSeries = async () => {
      const candles = (await db.get(getCandleCollection(id), company.symbol))
        .candles;
      return new CandleSeries(...candles);
    };
  });

  return dataSet;
}

/**
 * Loads a data set and saves it to the database.
 *
 * Does not override any existing data.
 * Creates a new data set if the one with this id doesn't yet exists.
 * Saves the candle series of the provided companies that are not
 * yet included in the data set. So populating the data set into database
 * can be paused and continued later by just running the function again.
 */
async function loadDataSet(
  id: string,
  description: string,
  resolution: Resolution,
  from: number,
  to: number,
  companies: CompanyProfile[]
) {
  const exists = !!(await db.get(collection, id));
  if (!exists) {
    await db.set(collection, id, {
      description,
      resolution,
      from,
      to,
      companies: [],
    });
  }

  const candleCollection = getCandleCollection(id);

  const loadedSymbols = (await db.get(collection, id)).companies.map(
    (c) => c.symbol
  );

  const isLoaded = (company) => loadedSymbols.includes(company.symbol);

  const promises = companies
    .filter((c) => !isLoaded(c))
    .map((company) => {
      const symbol = company.symbol;
      return loadCandles({
        market: "stock",
        symbol,
        resolution,
        from,
        to,
      })
        .then(async (candles) => {
          // Set the candles in another collection with company symbol as the id,
          // to avoid mongodb's 16mb per document limit
          await db.set(candleCollection, symbol, { symbol, candles });
          return db.access((db) =>
            db
              .collection(collection)
              .updateOne({ _id: id }, { $push: { companies: company } })
          );
        })
        .then(() => console.log(`Data for ${symbol} added to data set ` + id));
    });
}

async function run() {
  const companies = await getStocksByMarketCap(10000, 100000);
  loadDataSet(
    "makkara",
    "Hourly candles for lower large-cap (10-100 billion), 1.5.-10.10.2020",
    "60",
    timestampFromUTC(2020, 5),
    timestampFromUTC(2020, 10, 10),
    companies
  );
}

run();

// (async () => {
//   const dataSet = await getDataSet("makkara");
//   console.log(dataSet.companies);
//   dataSet.companies.slice(0, 2).forEach((comp) => {
//     comp.getCandleSeries().then((series) => {
//       console.log(comp.symbol);
//       console.log(series.slice(-2));
//     });
//   });
// })();
