import fetch from "node-fetch";
import { properties } from "../properties";

const { finnhub_api_key } = properties;

if (!finnhub_api_key) {
  throw new Error("Failed to read finnhub_api_key from properties.json");
}

// Finnhub API call limits
const MAX_CALLS_IN_SEC = 30;
const MAX_CALLS_IN_MIN = 60;

let callsInSec = 0;
let callsInMin = 0;

/**
 * Loads financial data from https://finnhub.io/.
 *
 * Finnhub has API call limits 60/min and 30/sec, and this function takes care of
 * postponing requests automatically when hitting those limits.
 */
export function fetchFromFinnhub(
  market: "forex" | "stock",
  type: "candle" | "symbol" | "profile2",
  queryParams: any
): Promise<any> {
  if (callsInSec >= MAX_CALLS_IN_SEC || callsInMin >= MAX_CALLS_IN_MIN) {
    return new Promise((resolve) => setTimeout(resolve, 1000)).then(() =>
      fetchFromFinnhub(market, type, queryParams)
    );
  } else {
    callsInSec++;
    callsInMin++;

    return doFetchFromFinnhub(market, type, queryParams).finally(() => {
      setTimeout(() => callsInSec--, 1000);
      setTimeout(() => callsInMin--, 60000);
    });
  }
}

function doFetchFromFinnhub(
  market: "forex" | "stock",
  type: "candle" | "symbol" | "profile2",
  queryParams: any
): Promise<any> {
  const queryParamsString =
    (queryParams &&
      Object.getOwnPropertyNames(queryParams).reduce(
        (acc, current) => acc + `&${current}=${queryParams[current]}`,
        ""
      )) ||
    "";

  const url: string =
    `https://finnhub.io/api/v1/` +
    `${market}/${type}?` +
    `token=${finnhub_api_key}` +
    queryParamsString;

  console.log("Fetching from url:\n" + url);

  return fetch(url).then((res) => {
    if (!res.ok) {
      throw new Error(`Failed to fetch data: ${res.status} ${res.statusText}`);
    }
    return res.json();
  });
}
