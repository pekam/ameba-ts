import React from "react";
import { ReactTabulator } from "react-tabulator";
import "react-tabulator/css/tabulator.min.css";
import { Trade } from "../../src/core/types";
import { FtxBacktestResult } from "../../src/ftx/ftx-backtest-store";
import { toDateString } from "../../src/shared/time-util";

function BacktestTradeTable({
  ftxBacktestResult,
  setSelectedTrade,
}: {
  ftxBacktestResult: FtxBacktestResult;
  setSelectedTrade: (trade: Trade) => void;
}) {
  function formatTime(cell: any): string {
    const timestamp: number = cell.getValue();
    return toDateString(timestamp);
  }

  const columns = [
    { title: "Position", field: "position" },
    {
      title: "Profit",
      field: "profit",
      hozAlign: "end",
      formatter: (cell: any) => {
        const value: number = cell.getValue();

        const color = value > 0 ? "green" : "red";

        return `<span style="color:${color}">${value.toFixed(4)}</span>`;
      },
    },
    { title: "Entry time", field: "entryTime", formatter: formatTime },
    { title: "Exit time", field: "exitTime", formatter: formatTime },
    {
      title: "Duration",
      field: "duration",
      formatter: (cell: any) => {
        const seconds: number = cell.getValue();
        const hours = Math.floor(seconds / 3600);
        const minutes = (seconds % 3600) / 60;
        return `${hours}h ${minutes}min`;
      },
    },
  ];

  const trades = ftxBacktestResult.result.trades;

  const data = trades.map((trade) => ({
    trade,
    position: trade.position,
    profit: trade.profit,
    entryTime: trade.entry.time,
    exitTime: trade.exit.time,
    duration: trade.exit.time - trade.entry.time,
  }));

  return (
    <ReactTabulator
      className="BacktestDataTable"
      data={data}
      columns={columns}
      tooltips={true}
      rowClick={(e, row) => {
        const trade = row._row.data.trade;
        setSelectedTrade(trade);
      }}
    />
  );
}

export default BacktestTradeTable;
