/**
 * Note: This file cannot have any direct imports
 * of hardhat since it is used in hardhat.config.ts.
 */
import { HardhatEthersHelpers } from "@nomiclabs/hardhat-ethers/types";
import { Wallet } from "ethers";

/**
 *
 * @returns Wallet constructed from DEPLOYER_ env vars
 */
export default function defaultDeployerWallet(
  ethers: HardhatEthersHelpers,
): Wallet {
  return Wallet.fromMnemonic(
    `${process.env.DEPLOYER_MNEMONIC}`,
    `m/44'/60'/0'/0/${process.env.DEPLOYER_SET_INDEX}`,
  ).connect(ethers.provider);
}
