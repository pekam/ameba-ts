import { Dictionary } from "../util/type-util";

export interface OHLC {
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface Candle extends OHLC {
  volume?: number;
  time: number;
}

export type CandleSeries = Array<Candle>;

interface OrderBase {
  /**
   * Defines whether this is a buy or a sell order.
   */
  side: OrderSide;
  /**
   * How many units to buy/sell.
   */
  size: number;
  /**
   * The order type (market, limit or stop order).
   */
  type: OrderType;
}
interface OrderWithPrice extends OrderBase {
  /**
   * Limit price for a limit order, or stop price for a stop order.
   */
  price: number;
}
export interface MarketOrder extends OrderBase {
  type: "market";
}
export interface LimitOrder extends OrderWithPrice {
  type: "limit";
}
export interface StopOrder extends OrderWithPrice {
  type: "stop";
}
export type Order = MarketOrder | LimitOrder | StopOrder;

export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit" | "stop";

export interface MarketPosition {
  /**
   * Whether this is a long or short position.
   */
  side: "long" | "short";
  /**
   * The number of units being long or short.
   */
  size: number;
}

export interface Transaction {
  /**
   * Defines if this is a buy or a sell transaction.
   */
  side: OrderSide;
  /**
   * How many units were bought/sold.
   */
  size: number;
  /**
   * The price at which the buy/sell occurred.
   */
  price: number;
  /**
   * The moment when the transaction took place, in unix time.
   */
  time: number;
  /**
   * The transaction cost paid for the transaction, in cash.
   */
  commission: number;
}

export interface Trade {
  /**
   * The symbol of the traded asset.
   */
  symbol: string;
  entry: Transaction;
  exit: Transaction;
  position: MarketPosition;
  absoluteProfit: number;
  /**
   * The relative win/loss in the
   * invested money. For example:
   * - 10% win: profit = 0.10
   * - 0.5% loss: profit = -0.005
   */
  relativeProfit: number;
}

/**
 * The state of a single asset during strategy execution.
 */
export interface AssetState {
  /**
   * The symbol that identifies this asset. For example "AAPL" for Apple stock,
   * or "BTC" for Bitcoin.
   */
  symbol: string;
  /**
   * The price data of this asset up to the present moment. When a new candle
   * forms, it's added to this series and the strategy function is called to
   * make updates to the orders based on the new information.
   */
  series: CandleSeries;
  /**
   * Indicates the current position ("long" or "short") with this asset. The
   * value is `null` when there's no position.
   */
  position: MarketPosition | null;
  /**
   * The order to enter a position, set by a strategy function, or `null` when
   * there's no active entry or position.
   *
   * When there's no position with the asset, this enty order will be active in
   * the market. When there is a position, the entry order that got triggered
   * remains in the `AssetState` for reference. When exiting a position (either
   * `stopLoss` or `takeProfit` order is triggered), the entry order is reset to
   * `null`.
   */
  entryOrder: Order | null;
  /**
   * The limit price of the take profit order, or `null` if no take profit order
   * should be placed.
   *
   * When there's a position and `takeProfit` is defined, there will be an
   * active limit order to exit the entire position, with the value of this
   * property as the limit price. When exiting a position (either `stopLoss` or
   * `takeProfit` order is triggered), this is reset to `null`.
   *
   * The strategy can provide the `takeProfit` price already with the
   * `entryOrder` (before there's any position). This ensures that the take
   * profit order is entered as soon as the entry order is triggered, instead of
   * waiting for the candle to finish.
   */
  takeProfit: number | null;
  /**
   * The stop price of the stop loss order, or `null` if no stop loss order
   * should be placed.
   *
   * When there's a position and `stopLoss` is defined, there will be an active
   * stop order to exit the entire position, with the value of this property as
   * the stop price. When exiting a position (either `stopLoss` or `takeProfit`
   * order is triggered), this is reset to `null`.
   *
   * The strategy can provide the `stopLoss` price already with the `entryOrder`
   * (before there's any position). This ensures that the stop loss order is
   * entered as soon as the entry order is triggered, instead of waiting for the
   * candle to finish.
   */
  stopLoss: number | null;
  /**
   * A list of buy and sell transactions of this asset since starting to run the
   * strategy.
   */
  transactions: Transaction[];
  /**
   * A list of completed trades of this asset since starting to run the
   * strategy.
   */
  trades: Trade[];
  /**
   * An object to store custom properties, used by strategies to keep track of
   * things across iterations.
   */
  data: Dictionary<any>;
}

/**
 * An update that a strategy function wishes to make to the orders of an asset.
 * Refer to {@link AssetState} docs for details of the properties.
 *
 * The changes will be applied to the asset state with the spread operator. This
 * means that:
 * - You can skip a property to not change it. An empty object can be returned
 *   to not make any changes to the asset state.
 * - To cancel an order, you need to explicitly provide `null` or `undefined` as
 *   the value.
 *
 * When in a position, changes to `entryOrder` should not be made.
 *
 * The `data` object can be used to carry custom properties to the following
 * iterations.
 */
export interface SingleAssetStrategyUpdate {
  entryOrder?: Order | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  data?: Dictionary<any>;
}

/**
 * An update containing all the changes a strategy function wishes to make to
 * any of the assets. The keys of this object are the symbols referring to which
 * asset the particular update concerns.
 */
export type FullStrategyUpdate = {
  [symbol: string]: SingleAssetStrategyUpdate;
};

/**
 * A complete strategy function that can be executed with a backtester or a
 * broker. In contrast to `TradingStrategy`, this type of a strategy can
 * handle multiple assets and position sizing.
 *
 * When new candles are formed in the market data, the strategy function is
 * called with the added candles in each asset's series, as well as the updated
 * positions, cash balance etc. The strategy can then react to these changes by
 * returning an update object with changes it wishes to make to the orders of
 * any assets.
 */
export type FullTradingStrategy = (state: FullTradeState) => FullStrategyUpdate;

/**
 * The state including the relevant information for a trading strategy to make
 * decisions. This includes the account's cash balance, market data, current
 * positions and active orders.
 */
export interface FullTradeState {
  /**
   * The current cash balance of the account.
   *
   * Note that when using margin, this can basically have any number value:
   * - The balance can be negative, when having leveraged long positions (assets
   *   have been bought with borrowed money)
   * - The balance can be more than the account's total value, when having short
   *   positions (borrowed assets have been sold)
   */
  cash: number;
  /**
   * The states of each included asset, in an object where the key is the
   * asset's symbol. See {@link AssetState} for more details.
   */
  assets: AssetMap;
  /**
   * Symbols of assets which have been updated with a new candle since the
   * previous update.
   *
   * Ideally this would include all the symbols, but there are reasons for not
   * every asset getting a new candle at the same time, e.g.:
   * - Some data providers do not provide a new candle if the asset was traded
   *   zero times during the period
   * - There are assets with different trading hours, e.g. US stocks and
   *   European stocks
   */
  updated: string[];
  /**
   * The timestamp of the last added candles, as seconds since the Unix epoch.
   */
  time: number;
}

/**
 * Function that provides simulated commissions (transaction costs) for the
 * backtester.
 *
 * For example, if the commission is 0.1% of the transaction's cash value:
 * ```
 * const commissionProvider = (transaction: Transaction) =>
 *   transaction.size * transaction.price * 0.001
 * ```
 * Or if you want to simulate a stock broker which charges $0.005 per share, but
 * min $1 per transaction, and max 1% of the transaction's value:
 * ```
 * const commissionProvider = (transaction: Transaction) =>
 *   Math.max(
 *     Math.min(transaction.size * 0.005, 1),
 *     0.01 * transaction.size * transaction.price)
 * ```
 * (based on a real commission plan of a particular stock broker)
 */
export type CommissionProvider = (
  transaction: Omit<Transaction, "commission">
) => number;

/**
 * Mapping from a symbol to the corresponding asset state.
 */
export type AssetMap = { [symbol: string]: AssetState };

/**
 * Mapping from a symbol to the corresponding candle series.
 */
export type SeriesMap = { [key: string]: CandleSeries };

export interface Range {
  readonly from: number;
  readonly to: number;
}
