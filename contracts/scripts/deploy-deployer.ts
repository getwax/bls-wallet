import * as dotenv from "dotenv";

// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { defaultAbiCoder } from "@ethersproject/abi";
import { BigNumber } from "@ethersproject/bignumber";
import { ethers } from "hardhat";

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
    Account Index: ${process.env.DEPLOYER_SET_INDEX},
    eoaAddress: ${eoaAddress},
    nonce: ${await deployer.getTransactionCount()}
  `);

  let newAddy = ethers.utils.getContractAddress({
    from: eoaAddress,
    nonce: BigNumber.from(0)
  });
  console.log("expected create2Deployer at:", newAddy);

  // We get the contract to deploy
  const Create2Deployer = await ethers.getContractFactory("Create2Deployer");
  const create2Deployer = await Create2Deployer.deploy();

  await create2Deployer.deployed();
  console.log("create2Deployer deployed to:", create2Deployer.address);


  const initCodeHash = ethers.utils.solidityKeccak256(
    ["bytes"],
    [Create2Deployer.bytecode]
  );
  console.log("ethers create2 expect at :", ethers.utils.getCreate2Address(
    create2Deployer.address,
    "0x"+"00".repeat(32),
    initCodeHash
  ));

  console.log("solidity create2 expected:", await create2Deployer.addressFrom(
    create2Deployer.address,
    "0",
    Create2Deployer.bytecode
  ));

  await create2Deployer.deploy(
    "0",
    Create2Deployer.bytecode
  );

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
