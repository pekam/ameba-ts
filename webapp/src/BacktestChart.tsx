import {
  createChart,
  CrosshairMode,
  IChartApi,
  LineStyle,
} from "lightweight-charts";
import { pick } from "lodash";
import React, { useEffect, useState } from "react";
import { Candle, CandleSeries, OHLC, Trade } from "../../src/core/types";
import { FtxBacktestResult } from "../../src/ftx/ftx-backtest-store";
import { m } from "../../src/shared/functions";
import { indicators } from "../../src/shared/indicators";
import { ftxResolutionToPeriod, toDateTime } from "../../src/shared/time-util";
import "./BacktestChart.css";

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
  const [legendCandle, setLegendCandle] = useState<Candle>(m.last(candles));

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

    const markers = ftxBacktestResult.result.trades.flatMap((trade) => {
      return [trade.entry, trade.exit].map((order, i) => ({
        time: order.time,
        position: order.side === "buy" ? "belowBar" : "aboveBar",
        shape: order.side === "buy" ? "arrowUp" : "arrowDown",
        color: "#2196F3",
        size: 0.5,
        text: i === 1 ? m.formatPercentage(trade.profit) : undefined,
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

    const emaSeries = chart.addLineSeries({
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      lineWidth: 1,
    });
    emaSeries.setData(
      // @ts-ignore
      indicators.withTimes(indicators.ema(candles, 20).values, candles)
    );

    chart.subscribeCrosshairMove((param) => {
      const ohlc = param.seriesPrices.get(series) as OHLC;
      const time = param.time as number | undefined;
      if (ohlc && time) {
        setLegendCandle((oldValue) => {
          if (oldValue.time === time) {
            return oldValue;
          }
          return { ...ohlc, time };
        });
      }
    });
  }, [candles, ftxBacktestResult]);

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

  return (
    <div id="backtestChart">
      <Legend candle={legendCandle}></Legend>
    </div>
  );
}

function Legend({ candle }: { candle: Candle }) {
  const diff = candle.close - candle.open;
  const relativeDiff = diff / candle.open;
  const range = candle.high - candle.low;
  const relativeRange = range / candle.low;

  function objectToString(obj: any) {
    return JSON.stringify(obj)
      .replaceAll('"', "")
      .replaceAll("{", "")
      .replaceAll("}", "")
      .replaceAll(",", "\n")
      .replaceAll(":", ": ");
  }

  return (
    <div className="BacktestChartLegend">
      <div>{objectToString(pick(candle, "open", "high", "low", "close"))}</div>
      <div>
        {objectToString({
          time: candle.time + " / " + toDateTime(candle.time).toISO(),
          diff: diff.toFixed(5) + " / " + m.formatPercentage(relativeDiff),
          range: range.toFixed(5) + " / " + m.formatPercentage(relativeRange),
        })}
      </div>
    </div>
  );
}

export default BacktestChart;
