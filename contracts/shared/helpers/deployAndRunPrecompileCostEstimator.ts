import { ethers } from "hardhat";

export default async function deployAndRunPrecompileCostEstimator(): Promise<string> {
    let BNPairingPrecompileCostEstimator = await ethers.getContractFactory("BNPairingPrecompileCostEstimator");
    let bnPairingPrecompileCostEstimator = await BNPairingPrecompileCostEstimator.deploy();
    await bnPairingPrecompileCostEstimator.deployed();
    await (await bnPairingPrecompileCostEstimator.run()).wait();
    return bnPairingPrecompileCostEstimator.address;
}
