import { timestampFromUTC } from "../core/date-util";
import { m } from "../functions/functions";
import { ftx } from "./ftx";

ftx.getAccount().then(console.log);
ftx
  .getCandles({
    marketName: "BTC/USD",
    resolution: "5min",
    startTime: timestampFromUTC(2021, 1, 28, 17, 15),
    endTime: timestampFromUTC(2021, 1, 29),
  })
  .then((series) => {
    console.log(m.last(series));
  });
