import * as fs from "fs";
import * as path from "path";
import fetch from "node-fetch";

const { finnhub_api_key } = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "properties.json"), "utf8")
);

if (!finnhub_api_key) {
  throw new Error("Failed to read finnhub_api_key from properties.json");
}

export function fetchFromFinnhub(
  market: "forex" | "stock",
  type: "candle" | "symbol",
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
