import {
  createChart,
  CrosshairMode,
  IChartApi,
  LineStyle,
} from "lightweight-charts";
import React, { useEffect } from "react";
import { CandleSeries, Trade } from "../../src/core/types";
import { FtxBacktestResult } from "../../src/ftx/ftx-backtest-store";
import { ftxResolutionToPeriod } from "../../src/shared/periods";

let chart: IChartApi | undefined;

function BacktestChart({
  series: candles,
  ftxBacktestResult,
  selectedTrade,
}: {
  series: CandleSeries;
  ftxBacktestResult: FtxBacktestResult;
  selectedTrade: Trade | null;
}) {
  useEffect(() => {
    chart = createChart("backtestChart", {
      width: document.body.clientWidth,
      height: window.innerHeight / 2,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: { mode: CrosshairMode.Normal },
    });

    const series = chart.addCandlestickSeries({
      priceLineVisible: false,
      lastValueVisible: false,
    });

    function formatProfit(profit: number): string {
      return `${profit > 0 ? "+" : ""}${(profit * 100).toFixed(2)}%`;
    }

    const markers = ftxBacktestResult.result.trades.flatMap((trade) => {
      return [trade.entry, trade.exit].map((order, i) => ({
        time: order.time,
        position: order.side === "buy" ? "belowBar" : "aboveBar",
        shape: order.side === "buy" ? "arrowUp" : "arrowDown",
        color: "#2196F3",
        size: 0.5,
        text: i === 1 ? formatProfit(trade.profit) : undefined,
      }));
    });

    // @ts-ignore
    series.setMarkers(markers);
    // @ts-ignore
    series.setData(candles);

    ftxBacktestResult.result.trades.forEach((trade) => {
      const color = trade.profit > 0 ? "lightgreen" : "pink";
      const area = chart!.addAreaSeries({
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        lineStyle: LineStyle.Solid,
        lineWidth: 1,
        lineColor: color,
        topColor: color,
        bottomColor: color,
      });
      area.setData(
        // @ts-ignore
        [trade.entry, trade.exit].map((order) => ({
          time: order.time,
          value: order.price,
        }))
      );
    });
  }, []);

  useEffect(() => {
    const candlePeriod = ftxResolutionToPeriod[ftxBacktestResult.resolution];
    const margin = candlePeriod * 20;
    if (selectedTrade && chart) {
      chart.timeScale().setVisibleRange({
        // @ts-ignore
        from: selectedTrade.entry.time - margin,
        // @ts-ignore
        to: selectedTrade.exit.time + margin,
      });
    }
  }, [selectedTrade]);

  return <div id="backtestChart"></div>;
}

export default BacktestChart;
