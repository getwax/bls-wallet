import * as dotenv from "dotenv";
import "@nomiclabs/hardhat-ethers";

import { ethers } from "hardhat";
import { Wallet } from "ethers";
import { Create2Deployer } from "../../typechain";

export function deployerAddress(): string {
  return connectDeployerWallet().address;
}

function connectDeployerWallet(): Wallet {
  return ethers.Wallet.fromMnemonic(
    `${process.env.DEPLOYER_MNEMONIC}`,
    `m/44'/60'/0'/0/${process.env.DEPLOYER_SET_INDEX}`
  ).connect(ethers.provider);
}

export default async function deployDeployer(deployerWallet?: Wallet): Promise<Create2Deployer> {
  if (deployerWallet === undefined) {
    deployerWallet = connectDeployerWallet();
  }
  const Create2Deployer = await ethers.getContractFactory(
    "Create2Deployer",
    deployerWallet
  );
  return await (await Create2Deployer.deploy()).deployed();
}
