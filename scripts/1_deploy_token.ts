import { BigNumber, Signer, Contract } from "ethers";
import { readFile, readFileSync } from "fs";


import { network, ethers } from "hardhat";

const utils = ethers.utils;

const initialSupply = ethers.utils.parseUnits("1000000")

let baseToken: Contract, blsWallet: Contract;

async function main() {
  
  // setup erc20 token
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  baseToken = await MockERC20.deploy("AnyToken","TOK", initialSupply);
  await baseToken.deployed();

  console.log(`MockERC20: ${baseToken.address}`);
  
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
  