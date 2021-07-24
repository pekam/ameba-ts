import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CandleSeries } from "../../src/core/types";
import { FtxBacktestResult } from "../../src/ftx/ftx-backtest-store";
import BacktestChart from "./BacktestChart";

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
      Backtest id: {backtestId}
      <BacktestChart
        series={data.series}
        ftxBacktestResult={data.ftxBacktestResult}
      ></BacktestChart>
    </div>
  );
}

export default Backtest;
