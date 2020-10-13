import { getDataSet } from "./data/load-data-set";

const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const port = process.env.PORT || 5000;
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/api/hello", async (req, res) => {
  const dataSet = await getDataSet("makkara");
  const candles = await dataSet.companies[0].getCandleSeries();
  res.send({ candles });
});

app.listen(port, () => console.log(`Listening on port ${port}`));
