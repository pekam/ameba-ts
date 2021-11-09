import { AlpacaClient, AlpacaStream } from "@master-chief/alpaca";
import { properties } from "../properties";

const credentials = {
  key: properties.alpaca_api_key,
  secret: properties.alpaca_s,
  paper: true,
};

const client = new AlpacaClient({
  credentials,
});

function getStream() {
  return new AlpacaStream({
    credentials,
    type: "market_data",
    source: "iex",
  });
}

export const alpaca = {
  client,
  getStream,
};
