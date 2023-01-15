import { MarketPosition } from "../core/types";

export function balanceToMarketPosition(
  balance: number
): MarketPosition | null {
  if (balance === 0) {
    return null;
  }
  return {
    side: balance > 0 ? "long" : "short",
    size: Math.abs(balance),
  };
}

export function marketPositionToBalance(
  position: MarketPosition | null
): number {
  if (position === null) {
    return 0;
  }
  if (position.side === "long") {
    return position.size;
  } else {
    return -position.size;
  }
}
