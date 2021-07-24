import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CandleSeries } from "../../src/core/types";
import { FtxBacktestResult } from "../../src/ftx/ftx-backtest-store";
import BacktestChart from "./BacktestChart";
import BacktestStats from "./BacktestStats";

function Backtest() {
  const backtestId = useParams<{ backtestId: string }>().backtestId;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [data, setData] = useState<{
    series: CandleSeries;
    ftxBacktestResult: FtxBacktestResult;
  } | null>(null);

  useEffect(() => {
    (async function () {
      const data = await (await fetch(`/api/backtest/${backtestId}`)).json();
      if (data.errorMessage) {
        setErrorMessage(data.errorMessage);
        return;
      }
      setData(data);
    })();
  }, [backtestId]);

  if (errorMessage) {
    return <div>Error: {errorMessage}</div>;
  }
  if (!data) {
    return <div>loading...</div>;
  }
  return (
    <div>
      <BacktestChart
        series={data.series}
        ftxBacktestResult={data.ftxBacktestResult}
      ></BacktestChart>
      <BacktestStats
        backtestId={backtestId}
        ftxBacktestResult={data.ftxBacktestResult}
      />
    </div>
  );
}

export default Backtest;
