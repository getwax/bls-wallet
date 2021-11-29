import Create2Fixture from "./Create2Fixture";

export default async function precompileCostEstimator(): Promise<string> {
  const create2Fixture = Create2Fixture.create();
  const bnPairingPrecompileCostEstimator = await create2Fixture.create2Contract(
    "BNPairingPrecompileCostEstimator",
  );
  await (await bnPairingPrecompileCostEstimator.run()).wait();
  return bnPairingPrecompileCostEstimator.address;
}
