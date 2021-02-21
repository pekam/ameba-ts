import * as fs from "fs";
import * as path from "path";

export const properties: {
  finnhub_api_key: string;
  ftx: { subaccount: string; api_key: string; s: string }[];
} = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "properties.json"), "utf8")
);
