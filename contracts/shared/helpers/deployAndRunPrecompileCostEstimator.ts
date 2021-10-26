import { BigNumber } from "@ethersproject/bignumber";
import { ethers } from "hardhat";
import deployWithDeployer from "./deployWithDeployer";

export default async function deployAndRunPrecompileCostEstimator(): Promise<string> {
  let BNPairingPrecompileCostEstimator = await ethers.getContractFactory("BNPairingPrecompileCostEstimator");
//   let bnPairingPrecompileCostEstimator = await BNPairingPrecompileCostEstimator.deploy();
//   await bnPairingPrecompileCostEstimator.deployed();
  let bnPairingPrecompileCostEstimator = await deployWithDeployer(BNPairingPrecompileCostEstimator);
  await (await bnPairingPrecompileCostEstimator.run()).wait();
  return bnPairingPrecompileCostEstimator.address;
}
