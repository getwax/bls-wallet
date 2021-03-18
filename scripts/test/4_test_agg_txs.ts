import * as dotenv from "dotenv";
dotenv.config();

import { readFile, readFileSync } from "fs";

import BLSWrapper from "../../test/blsWrapper";


import { network, ethers as hhEthers, l2ethers } from "hardhat";
import { Signer, Contract } from "ethers";

let ethers:typeof hhEthers | typeof l2ethers;
ethers = hhEthers;
if (network.name == "optimism") {
  ethers = l2ethers;
}

const utils = ethers.utils;

import { arrayify } from "ethers/lib/utils";
import { init } from "../../lib/hubble-contracts/ts/mcl";
const DOMAIN_HEX = utils.keccak256("0xfeedbee5");
const DOMAIN = arrayify(DOMAIN_HEX);

const ACCOUNTS_LENGTH = 5;
let blsWrapper: BLSWrapper;

let aggregatorSigner: Signer;
let signers: Signer[];
let addresses: string[];

let erc20: Contract;
let blsWallet: Contract;

async function setup() {
  const provider = new ethers.providers.JsonRpcProvider();
  aggregatorSigner = new ethers.Wallet(`${process.env.PRIVATE_KEY_AGG}`, provider);

  signers = (await ethers.getSigners()).slice(0, ACCOUNTS_LENGTH);
  addresses = await Promise.all(signers.map(acc => acc.getAddress()));

  blsWrapper = new BLSWrapper(DOMAIN, "transfer", addresses);
  await blsWrapper.initKeyPairs();
  blsWrapper.resetDb();

  const MockERC20 = await ethers.getContractFactory("MockERC20");
  erc20 = MockERC20.attach(process.env.ERC20_CONTRACT_ADDRESS);

  const BLSWallet = await ethers.getContractFactory("MockBLSWallet");
  blsWallet = BLSWallet.attach(process.env.BLS_CONTRACT_WALLET);

}

async function printBalances() {
  const balances = await Promise.all(addresses.map(add => erc20.balanceOf(add)));
  console.log(balances);
}

async function sendTx(fromIndex, toIndex, amount) {
  console.log(`Sending from ${fromIndex} to ${toIndex}, ${amount}`);
  blsWrapper.addTx([addresses[toIndex], amount], fromIndex);
  await blsWrapper.postTx(fromIndex);
}

async function main() {
  await setup();
  await printBalances();
  const initialBalance = (await erc20.balanceOf(addresses[0]))
    .div(ACCOUNTS_LENGTH).toString();
  for (let i=0; i< ACCOUNTS_LENGTH; i++) {
    await sendTx(0, i, initialBalance);
  }
  
  console.log(await blsWrapper.getCount());

  //TODO: batch transfer
  await printBalances();

}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
  