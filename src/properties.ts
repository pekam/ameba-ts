import * as fs from "fs";
import * as path from "path";

export const properties: {
  finnhub_api_key: string;
  ftx: { subaccount: string; api_key: string; s: string; peak?: number }[];
  ftx_data_subaccount: string;
} = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "properties.json"), "utf8")
);

export function getFtxSubAccountProperties(subaccount: string | undefined) {
  const props = properties.ftx.find((f) => f.subaccount === subaccount);
  if (!props) {
    throw new Error(
      `Ftx api keys for subaccount '${subaccount}' not found in properties.json`
    );
  }
  return props;
}
