import { Staker } from "../core/staker";
import { createStaker } from "./common-staker";

/**
 * Places the entire account balance on one trade, holding max one position at
 * any time. Allows fractions.
 */
export const allInStaker: Staker = createStaker({
  maxRelativeRisk: 1,
  maxRelativeExposure: 1,
  allowFractions: true,
});
