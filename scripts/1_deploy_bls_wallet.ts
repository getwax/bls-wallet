require('dotenv').config();
import { Console } from "console";
import { BigNumber, Signer, Contract } from "ethers";

import { network, ethers } from "hardhat";

const utils = ethers.utils;

let verificationGateway: Contract;
let blsExpander: Contract;

async function main() {

  let signer = (await ethers.getSigners())[0];
  let deployerAddress = await signer.getAddress();
  console.log(`Deployer account address: ${deployerAddress}`);

  // deploy bls wallet with token address
  const VerificationGateway = await ethers.getContractFactory("VerificationGateway");
  verificationGateway = await VerificationGateway.deploy();
  await verificationGateway.deployed();
  console.log(`verificationGateway: ${verificationGateway.address}`);

  // deploy bls wallet with token address
  const BLSExpander = await ethers.getContractFactory("BLSExpander");
  blsExpander = await BLSExpander.deploy();
  await blsExpander.deployed();
  blsExpander.initialize(
    verificationGateway.address
  );
  console.log(`blsExpander: ${blsExpander.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
  