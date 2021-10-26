import * as dotenv from "dotenv";

// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, network } from "hardhat";
import deployDeployer from "../shared/helpers/deployDeployer";

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');
  let deployer = (await ethers.getSigners())[0];
  let eoaAddress = deployer.address;
  console.log(`
    Network: ${network.name},
    Account Index: ${process.env.DEPLOYER_SET_INDEX},
    eoaAddress: ${eoaAddress},
    nonce: ${await deployer.getTransactionCount()}
  `);

  const create2Deployer = await deployDeployer();
  console.log("create2Deployer deployed to:", create2Deployer.address);

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
