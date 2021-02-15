require('dotenv').config();
import { Console } from "console";
import { BigNumber, Signer, Contract } from "ethers";

const ethers = require("hardhat").ethers;
const utils = ethers.utils;

let blsWallet: Contract;

async function main() {

  console.log(`agg: ${process.env.AGGREGATOR_ADDRESS}\n cont: ${process.env.ERC20_CONTRACT_ADDRESS}`)

  // deploy bls wallet with token address
  const BLSWallet = await ethers.getContractFactory("BLSWallet");
  blsWallet = await BLSWallet.deploy(
    process.env.AGGREGATOR_ADDRESS,
    process.env.ERC20_CONTRACT_ADDRESS
  );
  await blsWallet.deployed();
  
  console.log(`blsWallet: ${blsWallet.address}`);
  
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
  