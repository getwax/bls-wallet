import * as dotenv from "dotenv";
import "@nomiclabs/hardhat-ethers";

import { ethers } from "hardhat";
import { Wallet, BigNumber } from "ethers";
import { Create2Deployer } from "../../typechain";

dotenv.config();

export function defaultDeployerAddress(): string {
  return defaultDeployerWallet().address;
}

/**
 * 
 * @returns Wallet constructed from DEPLOYER_ env vars
 */
export function defaultDeployerWallet(): Wallet {
  return ethers.Wallet.fromMnemonic(
    `${process.env.DEPLOYER_MNEMONIC}`,
    `m/44'/60'/0'/0/${process.env.DEPLOYER_SET_INDEX}`
  ).connect(ethers.provider);
}

/**
 * 
 * @param deployerWallet EOA to deploy contract, otherwise defaultDeployerWallet
 * @returns create2Deployer Contract at the expected address, deploying one if not yet deployed
 */
export default async function deployerContract(): Promise<Create2Deployer> {
  let deployerWallet = defaultDeployerWallet();

  const Create2Deployer = await ethers.getContractFactory(
    "Create2Deployer",
    deployerWallet
  );

  let deployerAddress = ethers.utils.getContractAddress({
    from: deployerWallet.address,
    nonce: 0 // expect first tx to have been deployment
  });

  // If deployer contract doesn't exist at expected address, deploy it there
  if ((await ethers.provider.getCode(deployerAddress)) ===  "0x") {
    if (await deployerWallet.getTransactionCount() > 0) {
      throw("No contract at expected address, and first transaction already used");
    }
    await (await Create2Deployer.deploy()).deployed();
  }

  return Create2Deployer.attach(deployerAddress);
}
