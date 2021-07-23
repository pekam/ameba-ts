import * as bodyParser from "body-parser";
import * as express from "express";
import { CandleSeries } from "./core/types";
import { CompanyWithAsyncCandles, getDataSet } from "./data/load-data-set";
import { ftxResolutionToPeriod, getFtxClient } from "./ftx/ftx";
import { ftxBacktestStore } from "./ftx/ftx-backtest-store";
import { ftxDataStore } from "./ftx/ftx-data-store";
import { getFtxUtil } from "./ftx/ftx-util";

const app = express();
const port = process.env.PORT || 5000;
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/api/dataSet/:dataSetId/:symbol", async (req, res) => {
  const dataSet = await getDataSet(req.params.dataSetId);
  const company: CompanyWithAsyncCandles | undefined = dataSet.companies.find(
    (c) => c.symbol === req.params.symbol
  );
  if (!company) {
    return { symbol: "NOT_FOUND", name: "NOT_FOUND", candles: [] };
  }
  const candles = await company.getCandleSeries();
  res.send({ ...company, candles });
});

app.get("/api/backtest/:backtestId", async (req, res) => {
  const backtestId = parseInt(req.params.backtestId);
  const ftxBacktestResult = await ftxBacktestStore.loadBacktestResult(
    backtestId
  );
  if (!ftxBacktestResult) {
    console.log(`Backtest result with id ${backtestId} not found.`);
    res.send({ ok: false });
    return;
  }
  const { result, market, resolution } = ftxBacktestResult;

  // TODO subaccount hard-coded
  const ftx = getFtxClient({ subaccount: "bot-2" });
  const ftxUtil = getFtxUtil({ ftx, market });

  // Period of time before and after the actual backtest to load
  const candleMargin = ftxResolutionToPeriod[resolution] * 50;

  const series: CandleSeries = await ftxDataStore.getCandles({
    startDate: result.stats.range.from - candleMargin,
    endDate: result.stats.range.to + candleMargin,
    resolution,
    ftxUtil,
  });

  console.log(`Sending backtest result with id ${backtestId}.`);
  res.send({ series, ftxBacktestResult });
});

app.listen(port, () => console.log(`Listening on port ${port}`));
