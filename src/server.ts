import { CompanyWithAsyncCandles, getDataSet } from "./data/load-data-set";

const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const port = process.env.PORT || 5000;
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/api/:dataSet/:symbol", async (req, res) => {
  const dataSet = await getDataSet(req.params.dataSet);
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
