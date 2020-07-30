import { loadCandles } from "./core/load-data";
import { timestampFromUTC } from "./core/date-util";
import { findRSIDivergences } from "./strats/rsi-divergence";

loadCandles({
  market: "stock",
  symbol: "WMT",
  resolution: "D",
  from: timestampFromUTC(2019, 7, 1),
  to: timestampFromUTC(2020, 7, 30),
})
  .then((series) => {
    const rsiDivergences = findRSIDivergences(series, 14);
    console.log(rsiDivergences);
  })

  .catch(console.error);
