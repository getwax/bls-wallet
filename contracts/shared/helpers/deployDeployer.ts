import * as dotenv from "dotenv";
import "@nomiclabs/hardhat-ethers";

import { ethers } from "hardhat";
import { Wallet } from "ethers";
import { Create2Deployer } from "../../typechain";
import defaultDeployerWalletHardhat from "./defaultDeployerWallet";

dotenv.config();

export function defaultDeployerAddress(): string {
  return defaultDeployerWallet().address;
}

export function defaultDeployerWallet(): Wallet {
  return defaultDeployerWalletHardhat(ethers);
}

/**
 *
 * @param deployerWallet EOA to deploy contract, otherwise defaultDeployerWallet
 * @returns create2Deployer Contract at the expected address, deploying one if not yet deployed
 */
export default async function deployerContract(): Promise<Create2Deployer> {
  const deployerWallet = defaultDeployerWallet();

  const Create2Deployer = await ethers.getContractFactory(
    "Create2Deployer",
    deployerWallet,
  );

  const deployerAddress = ethers.utils.getContractAddress({
    from: deployerWallet.address,
    nonce: 0, // expect first tx to have been deployment
  });

  // If deployer contract doesn't exist at expected address, deploy it there
  if ((await ethers.provider.getCode(deployerAddress)) === "0x") {
    if ((await deployerWallet.getTransactionCount()) > 0) {
      throw new Error(
        "No contract at expected address, and first transaction already used",
      );
    }
    await (await Create2Deployer.deploy()).deployed();
  }

  return Create2Deployer.attach(deployerAddress);
}
