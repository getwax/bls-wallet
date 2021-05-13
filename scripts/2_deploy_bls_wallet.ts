require('dotenv').config();
import { Console } from "console";
import { BigNumber, Signer, Contract } from "ethers";

import { network, ethers } from "hardhat";

const utils = ethers.utils;

let verificationGateway: Contract;
let blsExpander: Contract;

async function main() {

  console.log(`agg: ${process.env.AGGREGATOR_ADDRESS}\n cont: ${process.env.ERC20_CONTRACT_ADDRESS}`)

  // deploy bls wallet with token address
  const VerificationGateway = await ethers.getContractFactory("VerificationGateway");
  verificationGateway = await VerificationGateway.deploy();
  await verificationGateway.deployed();
  console.log(`verificationGateway: ${verificationGateway.address}`);

  // deploy bls wallet with token address
  const BLSExpander = await ethers.getContractFactory("BLSExpander");
  blsExpander = await BLSExpander.deploy(
    verificationGateway.address
  );
  await blsExpander.deployed();
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
  