require('dotenv').config();

import { Contract } from "ethers";
import { ethers } from "hardhat";

const utils = ethers.utils;

let verificationGateway: Contract;
let blsExpander: Contract;

async function main() {

  let signer = (await ethers.getSigners())[0];
  let deployerAddress = await signer.getAddress();
  console.log(`Deployer account address: ${deployerAddress}`);


  // setup erc20 token
  const PayToken = await ethers.getContractFactory("MockERC20");
  let payToken = await PayToken.deploy(
    "PayToken",
    "PAY",
    ethers.utils.parseUnits("1000000")
  );
  await payToken.deployed();
  console.log(`PayToken: ${payToken.address}`);
  
  // deploy bls wallet with token address
  const VerificationGateway = await ethers.getContractFactory("VerificationGateway");
  let override = {
    // gasLimit: 50000000
  }
  verificationGateway = await VerificationGateway.deploy(override);
  await verificationGateway.deployed();
  console.log(`deployed verificationGateway: ${verificationGateway.address}`);
  await (await verificationGateway.initialize(
    payToken.address
  )).wait();
  console.log(`verificationGateway initialised`);

  // deploy bls wallet with token address
  const BLSExpander = await ethers.getContractFactory("BLSExpander");
  blsExpander = await BLSExpander.deploy();
  await blsExpander.deployed();
  console.log(`deployed blsExpander: ${blsExpander.address}`);
  await (await blsExpander.initialize(
    verificationGateway.address
  )).wait();
  console.log(`blsExpander initialised`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
  