import { CompanyProfile, getMidCapStocks } from "./load-company-profiles";
import { loadCandles, Resolution } from "./load-candle-data";
import { db } from "./mongo";
import { timestampFromUTC } from "../core/date-util";

const collection = "data-sets";

/**
 * Does not override any existing data.
 * Creates a new data set if the one with this id doesn't yet exists.
 * Pushes the candle series of the provided companies that are not
 * yet pushed to the data set.
 */
export async function loadDataSet(
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

  const loadedSymbols = (await db.get(collection, id)).companies.map(
    (c) => c["_id"]
  );

  const isLoaded = (company) => loadedSymbols.includes(company["_id"]);

  const promises = companies
    .filter((c) => !isLoaded(c))
    .map((company) => {
      const symbol = company["_id"]; // todo: company profile doesn't have 'symbol'
      return loadCandles({
        market: "stock",
        symbol,
        resolution,
        from,
        to,
      })
        .then((series) => {
          const companyWithData = { ...company, series };
          return db.access((db) =>
            db
              .collection(collection)
              .updateOne({ _id: id }, { $push: { companies: companyWithData } })
          );
        })
        .then(() => console.log(`Data for ${symbol} added to data set ` + id));
    });
}

async function run() {
  const companies = await getMidCapStocks();
  loadDataSet(
    "foo",
    "Daily candles for mid-cap in 2020 h1",
    "D",
    timestampFromUTC(2020, 1, 1),
    timestampFromUTC(2020, 6, 1),
    companies.slice(0, 3)
  );
}

// run();
