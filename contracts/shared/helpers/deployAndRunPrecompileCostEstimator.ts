import { BigNumber } from "@ethersproject/bignumber";
import { ethers } from "hardhat";
import Create2Fixture from "./Create2Fixture";

export default async function precompileCostEstimator(): Promise<string> {
  let create2Fixture = Create2Fixture.create();
  let bnPairingPrecompileCostEstimator
   = await create2Fixture.create2Contract("BNPairingPrecompileCostEstimator");
  await (await bnPairingPrecompileCostEstimator.run()).wait();
  return bnPairingPrecompileCostEstimator.address;
}
