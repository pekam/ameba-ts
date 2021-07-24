import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CandleSeries, Trade } from "../../src/core/types";
import { FtxBacktestResult } from "../../src/ftx/ftx-backtest-store";
import "./Backtest.css";
import BacktestChart from "./BacktestChart";
import BacktestStats from "./BacktestStats";
import BacktestTradeTable from "./BacktestTradeTable";

function Backtest() {
  const backtestId = useParams<{ backtestId: string }>().backtestId;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [data, setData] = useState<{
    series: CandleSeries;
    ftxBacktestResult: FtxBacktestResult;
  } | null>(null);

  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

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
        selectedTrade={selectedTrade}
      ></BacktestChart>
      <div className="BacktestBottomPanel">
        <BacktestTradeTable
          ftxBacktestResult={data.ftxBacktestResult}
          setSelectedTrade={setSelectedTrade}
        />
        <BacktestStats
          backtestId={backtestId}
          ftxBacktestResult={data.ftxBacktestResult}
        />
      </div>
    </div>
  );
}

export default Backtest;
