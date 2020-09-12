import { fetchFromFinnhub } from "./finnhub";
import * as fs from "fs";
import * as path from "path";

interface FinnhubSymbolResponse {
  currency: string;
  description: string;
  displaySymbol: string;
  symbol: string;
  type: string;
}

fetchFromFinnhub("stock", "symbol", { exchange: "US" }).then((json) => {
  const data: FinnhubSymbolResponse[] = json;

  const usStockSymbols = data.filter((symbolInfo) => symbolInfo.type === "EQS");

  writeDataToFile(usStockSymbols, "symbols.json");
});

const dataDirPath = path.join(__dirname, "..", "data");
function writeDataToFile(data: any, fileName: string) {
  if (!fs.existsSync(dataDirPath)) {
    fs.mkdirSync(dataDirPath);
  }
  fs.writeFileSync(
    path.join(dataDirPath, fileName),
    JSON.stringify(data),
    "utf8"
  );
}

function readDataFromFile(fileName: string) {
  const filePath = path.join(dataDirPath, fileName);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
