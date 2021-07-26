import { m } from "./functions";

/**
 * Calculates a risk level for the next trade between
 * the provided min and max based on the drawdown.
 * Accelerating when close to the peak, linearly
 * decreasing when drawdown increases, until reaches
 * minRisk at maxDrawDown.
 *
 * Based on Better System Trader episode 177.
 */
export function getRiskBasedOnDrawdown({
  accountValue,
  peakAccountValue,
  minRisk,
  maxRisk,
  maxDrawdown,
}: {
  accountValue: number;
  peakAccountValue: number;
  minRisk: number;
  maxRisk: number;
  maxDrawdown: number;
}) {
  if (maxDrawdown < 0 || maxDrawdown > 1) {
    throw Error(
      `Max drawdown should be between 0 and 1 but was ${maxDrawdown}`
    );
  }
  if (minRisk > maxRisk) {
    throw Error(
      "Min risk can't be higher than max risk " +
        JSON.stringify({ minRisk, maxRisk })
    );
  }

  if (accountValue >= peakAccountValue) {
    return maxRisk;
  }
  const drawdown = m.getRelativeDiff(accountValue, peakAccountValue, true);

  if (drawdown >= maxDrawdown) {
    return minRisk;
  }
  const progress = drawdown / maxDrawdown;

  return minRisk + (1 - progress) * (maxRisk - minRisk);
}
