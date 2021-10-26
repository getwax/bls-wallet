import { BigNumber } from "@ethersproject/bignumber";
import { ethers } from "hardhat";
import create2Contract from "./create2Contract";

export default async function deployAndRunPrecompileCostEstimator(): Promise<string> {
  let BNPairingPrecompileCostEstimator = await ethers.getContractFactory("BNPairingPrecompileCostEstimator");
  let bnPairingPrecompileCostEstimator = await create2Contract(BNPairingPrecompileCostEstimator);
  await (await bnPairingPrecompileCostEstimator.run()).wait();
  return bnPairingPrecompileCostEstimator.address;
}
