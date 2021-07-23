import { createChart } from "lightweight-charts";
import React, { useEffect, useState } from "react";
import { CompanyWithCandles } from "../../src/data/load-data-set";
import "./DataSetChart.css";

/**
 * @param dataSet the name of the data set from which to load the candles
 * @param symbolAndCandleTimes the symbol whose candles to load, and
 * optional timestamps of candles to mark in the chart separated by underscores,
 * e.g. "AAPL_123000000_124000000". The marker will be above the candle,
 * unless its prefixed with "b", in which case the marker will be
 * below the candle, e.g. "AAPL_b123000000".
 */
function DataSetChart({
  dataSetId,
  symbolAndCandleTimes,
}: {
  dataSetId: string;
  symbolAndCandleTimes: string;
}) {
  const chartInput = symbolAndCandleTimes.split("_");
  const symbol = chartInput[0];
  const candleTimes = chartInput.slice(1);

  const chartId = `${dataSetId}-${symbol}`;
  const [company, setCompany] = useState<CompanyWithCandles | null>(null);

  useEffect(() => {
    fetch(`api/dataSet/${dataSetId}/${symbol}`)
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
        series.setMarkers(markers.sort((a, b) => a.time - b.time));

        // @ts-ignore
        series.setData(data.candles);
      });
  }, []);

  return (
    <div className="DataSetChart">
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

export default DataSetChart;
