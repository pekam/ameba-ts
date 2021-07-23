import React from "react";
import { BrowserRouter, Route, Switch } from "react-router-dom";
import "./App.css";
import DataSet from "./DataSet";

function App() {
  return (
    <BrowserRouter>
      <Switch>
        <Route path="/dataSet">
          <DataSet />
        </Route>
      </Switch>
    </BrowserRouter>
  );
}

export default App;
