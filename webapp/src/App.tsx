import React, { useEffect, useState } from "react";
import "./App.css";
import Chart from "./Chart";

function App() {
  const [dataSet, setDataSet] = useState<string | null>(null);
  const [symbols, setSymbols] = useState<string[]>([]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const dataSet = urlParams.get("dataSet");
    const symbols = urlParams.get("symbols");
    if (dataSet && symbols) {
      setDataSet(dataSet);
      setSymbols(JSON.parse(symbols));
    }
  }, []);

  return (
    <div className="App">
      {dataSet &&
        symbols.map((s) => <Chart dataSet={dataSet} symbol={s} key={s} />)}
    </div>
  );
}

export default App;
