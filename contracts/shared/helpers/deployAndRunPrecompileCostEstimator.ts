import { BigNumber } from "@ethersproject/bignumber";
import { ethers } from "hardhat";
import Create2Factory from "./create2Contract";

export default async function precompileCostEstimator(): Promise<string> {
  let create2Factory = Create2Factory.create();
  let bnPairingPrecompileCostEstimator = await create2Factory.create2Contract(
    await ethers.getContractFactory("BNPairingPrecompileCostEstimator")
  );
  await (await bnPairingPrecompileCostEstimator.run()).wait();
  return bnPairingPrecompileCostEstimator.address;
}
