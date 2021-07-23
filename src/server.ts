import * as bodyParser from "body-parser";
import * as express from "express";
import { CompanyWithAsyncCandles, getDataSet } from "./data/load-data-set";

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

app.listen(port, () => console.log(`Listening on port ${port}`));
