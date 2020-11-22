import React, { useEffect, useState } from "react";
import { createChart, SeriesMarker } from "lightweight-charts";
import { CompanyWithCandles } from "../../src/data/load-data-set";
import "./Chart.css";

function Chart({
  dataSet,
  symbolAndMaybeCandleTime,
}: {
  dataSet: string;
  symbolAndMaybeCandleTime: string;
}) {
  const symbolAndCandleTime = symbolAndMaybeCandleTime.split("_");
  const symbol = symbolAndCandleTime[0];
  const candleTime = parseInt(symbolAndCandleTime[1]);

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

        if (candleTime) {
          const marker: SeriesMarker<number> = {
            time: candleTime,
            position: "aboveBar",
            color: "#2196F3",
            shape: "arrowDown",
            size: 0.5,
          };

          // @ts-ignore
          series.setMarkers([marker]);
        }

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
