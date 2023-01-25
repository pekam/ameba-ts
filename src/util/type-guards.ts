import {
  OrderSide,
  OrderType,
  ORDER_SIDES,
  ORDER_TYPES,
  PositionSide,
  POSITION_SIDES,
} from "../core/types";

export const isOrderSide = (s: string): s is OrderSide =>
  ORDER_SIDES.includes(s as OrderSide);

export const isOrderType = (s: string): s is OrderType =>
  ORDER_TYPES.includes(s as OrderType);

export const isPositionSide = (s: string): s is PositionSide =>
  POSITION_SIDES.includes(s as PositionSide);
