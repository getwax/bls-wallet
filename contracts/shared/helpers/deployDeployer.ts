import * as dotenv from "dotenv";
import "@nomiclabs/hardhat-ethers";

import { ethers } from "hardhat";
import { Wallet, BigNumber } from "ethers";
import { Create2Deployer } from "../../typechain";


export function defaultDeployerAddress(): string {
  return defaultDeployerWallet().address;
}

/**
 * 
 * @returns Wallet constructed from DEPLOYER_ env vars
 */
function defaultDeployerWallet(): Wallet {
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
export default async function deployerContract(deployerWallet?: Wallet): Promise<Create2Deployer> {
  if (deployerWallet === undefined) {
    deployerWallet = defaultDeployerWallet();
  }
  const Create2Deployer = await ethers.getContractFactory(
    "Create2Deployer",
    deployerWallet
  );

  let deployerAddress = ethers.utils.getContractAddress({
    from: deployerWallet.address,
    nonce: BigNumber.from(`${process.env.DEPLOYER_SET_INDEX}`)
  });

  // If deployer contract doesn't exist at expected address, deploy it there
  if ((await ethers.provider.getCode(deployerAddress)) ===  "0x") {
    await (await Create2Deployer.deploy()).deployed();
  }

  return Create2Deployer.attach(deployerAddress);
}
