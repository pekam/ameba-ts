import React, { useEffect, useState } from "react";
import { createChart } from "lightweight-charts";
import { CompanyWithCandles } from "../../src/data/load-data-set";
import "./Chart.css";

function Chart({ dataSet, symbol }: { dataSet: string; symbol: string }) {
  const chartId = `${dataSet}-${symbol}`;
  const [company, setCompany] = useState<CompanyWithCandles | null>(null);
  useEffect(() => {
    fetch(`api/${dataSet}/${symbol}`)
      .then((res) => res.json())
      .then((data: CompanyWithCandles) => {
        setCompany(data);

        const chart = createChart(chartId, {
          width: 800,
          height: 500,
        });
        const series = chart.addCandlestickSeries();

        // @ts-ignore
        series.setData(data.candles);
      });
  }, []);

  return (
    <div className="Chart">
      <div id={chartId}></div>
      {company ? (
        <ul>
          <li>{company.symbol}</li>
          <li>{company.name}</li>
        </ul>
      ) : (
        "loading..."
      )}
    </div>
  );
}

export default Chart;
