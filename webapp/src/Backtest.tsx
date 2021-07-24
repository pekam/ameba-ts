import React from "react";
import { useParams } from "react-router-dom";

function Backtest() {
  const backtestId = useParams<{ backtestId: string }>().backtestId;
  return <div>{backtestId}</div>;
}

export default Backtest;
