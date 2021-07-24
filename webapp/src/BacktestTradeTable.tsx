import React from "react";
import { ReactTabulator } from "react-tabulator";
import "react-tabulator/css/tabulator.min.css";
import { FtxBacktestResult } from "../../src/ftx/ftx-backtest-store";

function BacktestTradeTable({
  ftxBacktestResult,
}: {
  ftxBacktestResult: FtxBacktestResult;
}) {
  function formatTime(cell: any): string {
    const timestamp: number = cell.getValue();
    return new Date(timestamp * 1000)
      .toISOString()
      .substring(0, 16)
      .replace("T", " ");
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
    />
  );
}

export default BacktestTradeTable;
