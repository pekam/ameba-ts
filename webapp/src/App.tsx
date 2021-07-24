import React from "react";
import { BrowserRouter, Route, Switch } from "react-router-dom";
import "./App.css";
import Backtest from "./Backtest";
import DataSet from "./DataSet";

function App() {
  return (
    <BrowserRouter>
      <Switch>
        <Route path="/dataSet">
          <DataSet />
        </Route>
        <Route path="/backtest/:backtestId">
          <Backtest />
        </Route>
      </Switch>
    </BrowserRouter>
  );
}

export default App;
