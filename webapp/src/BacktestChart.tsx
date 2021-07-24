import { createChart, CrosshairMode } from "lightweight-charts";
import React, { useEffect } from "react";
import { CandleSeries } from "../../src/core/types";
import { FtxBacktestResult } from "../../src/ftx/ftx-backtest-store";

function BacktestChart({
  series: candles,
  ftxBacktestResult,
}: {
  series: CandleSeries;
  ftxBacktestResult: FtxBacktestResult;
}) {
  useEffect(() => {
    const chart = createChart("backtestChart", {
      width: document.body.clientWidth,
      height: window.innerHeight / 2,
    });

    const series = chart.addCandlestickSeries();
    // @ts-ignore
    series.setData(candles);

    series.applyOptions({ priceLineVisible: false, lastValueVisible: false });
    chart.applyOptions({ crosshair: { mode: CrosshairMode.Normal } });
  });

  return <div id="backtestChart"></div>;
}

export default BacktestChart;
