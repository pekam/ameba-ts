import React from "react";
import ReactJson from "react-json-view";
import { FtxBacktestResult } from "../../src/ftx/ftx-backtest-store";

function BacktestStats({
  backtestId,
  ftxBacktestResult,
}: {
  backtestId: string;
  ftxBacktestResult: FtxBacktestResult;
}) {
  const range = ftxBacktestResult.result.stats.range;
  const convertTimestamp = (time: number): [number, string] => [
    time,
    new Date(time * 1000).toISOString(),
  ];

  return (
    <ReactJson
      src={{
        backtestId,
        market: ftxBacktestResult.market,
        resolution: ftxBacktestResult.resolution,
        ...ftxBacktestResult.result.stats,
        range: {
          from: convertTimestamp(range.from),
          to: convertTimestamp(range.to),
        },
      }}
      displayDataTypes={false}
      displayObjectSize={false}
      name={null}
      enableClipboard={false}
    ></ReactJson>
  );
}

export default BacktestStats;
