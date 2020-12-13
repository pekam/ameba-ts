import React, { useEffect, useState } from "react";
import { createChart } from "lightweight-charts";
import { CompanyWithCandles } from "../../src/data/load-data-set";
import "./Chart.css";

/**
 * @param dataSet the name of the data set from which to load the candles
 * @param symbolAndCandleTimes the symbol whose candles to load, and
 * optional timestamps of candles to mark in the chart separated by underscores,
 * e.g. "AAPL_123000000_124000000". The marker will be above the candle,
 * unless its prefixed with "b", in which case the marker will be
 * below the candle, e.g. "AAPL_b123000000".
 */
function Chart({
  dataSet,
  symbolAndCandleTimes,
}: {
  dataSet: string;
  symbolAndCandleTimes: string;
}) {
  const chartInput = symbolAndCandleTimes.split("_");
  const symbol = chartInput[0];
  const candleTimes = chartInput.slice(1);

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

        const markers = candleTimes.map((candleTime) => {
          const markerBelow = candleTime.startsWith("b");
          const time = parseInt(
            markerBelow ? candleTime.substr(1) : candleTime
          );
          return {
            time: time,
            position: markerBelow ? "belowBar" : "aboveBar",
            color: "#2196F3",
            shape: markerBelow ? "arrowUp" : "arrowDown",
            size: 0.5,
          };
        });
        // @ts-ignore
        series.setMarkers(markers);

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
