import { BigNumber } from "ethers";

/**
 * Used to add a small safety premium to estimated fees. This protects
 * against small fluctuations is gas estimation, and thus increases
 * the chance that bundles get accepted during aggregation.
 *
 * @param feeEstimate fee required for bundle
 * @param safetyDivisor optional safety divisor. Default is 5
 * @returns fee estimate with added safety premium
 */
export default function addSafetyPremiumToFee(
  feeEstimate: BigNumber,
  safetyDivisor: number = 5,
): BigNumber {
  const safetyPremium = feeEstimate.div(safetyDivisor);
  return feeEstimate.add(safetyPremium);
}
