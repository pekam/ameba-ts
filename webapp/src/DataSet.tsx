import React, { useEffect, useState } from "react";
import "./App.css";
import DataSetChart from "./DataSetChart";

function DataSet() {
  const [dataSetId, setDataSetId] = useState<string | null>(null);
  const [symbols, setSymbols] = useState<string[]>([]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const dataSetId = urlParams.get("dataSetId");
    const symbols = urlParams.get("symbols");
    if (dataSetId && symbols) {
      setDataSetId(dataSetId);
      setSymbols(symbols.split(","));
    }
  }, []);

  return (
    <div>
      {dataSetId &&
        symbols.map((s) => (
          <DataSetChart
            dataSetId={dataSetId}
            symbolAndCandleTimes={s}
            key={s}
          />
        ))}
    </div>
  );
}

export default DataSet;
