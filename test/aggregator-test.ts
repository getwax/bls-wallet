import { expect, assert } from "chai";

import { network, ethers as hhEthers, l2ethers } from "hardhat";

let ethers:typeof hhEthers | typeof l2ethers;
ethers = hhEthers;
if (network.name == "optimism") {
  ethers = l2ethers;
}

import { BigNumber, Signer, Contract } from "ethers";
const utils = ethers.utils;

import * as mcl from "../lib/hubble-contracts/ts/mcl";
import { keyPair } from "../lib/hubble-contracts/ts/mcl";
import { arrayify } from "ethers/lib/utils";

import BLSWrapper from './blsWrapper'
const DOMAIN_HEX = utils.keccak256("0xfeedbee5");
const DOMAIN = arrayify(DOMAIN_HEX);

const zeroBLSPubKey = [0, 0, 0, 0].map(BigNumber.from);

const initialSupply = ethers.utils.parseUnits("1000000")

const ACCOUNTS_LENGTH = 5;
let signers: Signer[];
let addresses: string[];
let blsWrapper: BLSWrapper;

const userStartAmount = initialSupply.div(ACCOUNTS_LENGTH);

let baseToken: Contract, blsWallet: Contract;

async function init() {
  signers = (await ethers.getSigners()).slice(0, ACCOUNTS_LENGTH);
  addresses = await Promise.all(signers.map(acc => acc.getAddress()));

  blsWrapper = new BLSWrapper(
    DOMAIN,
    "transfer",
    addresses
  );
  await blsWrapper.initKeyPairs();

  // setup erc20 token
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  baseToken = await MockERC20.deploy("AnyToken","TOK", initialSupply);
  await baseToken.deployed();

  // deploy bls wallet with token address
  const BLSWallet = await ethers.getContractFactory("MockBLSWallet");
  blsWallet = await BLSWallet.deploy(addresses[0], baseToken.address); 
  await blsWallet.deployed();
  
  // split supply amongst addresses, and approve transfer from wallet
  for (let i = 0; i<signers.length; i++) {
    console.log(`Preparing account ${i+1}/${signers.length}`);
    await baseToken.connect(signers[0]).transfer(addresses[i], userStartAmount); // first account as aggregator, and holds token supply
    await baseToken.connect(signers[i]).approve(blsWallet.address, userStartAmount);
  }
}

async function depositToWallet(signers:Signer[]) {
  const n = signers.length;

  for (let i=0; i<n; i++) {
    await blsWallet.connect(signers[i]).deposit(blsWrapper.pubKeyForIndex(i), userStartAmount);
  }
}

/**
 * Signs bls token transfers from each address to the last.
 * The last account should hold all tokens (minus a tiny portion from rounding).
 */
function createTestTxs(): BLSWrapper {
  const n = addresses.length;

  for (let i = 0; i < n; i++) {
      const recipient = addresses[n-1];
      const amount = userStartAmount.toString();
      blsWrapper.addTx([recipient, amount], i);
  }
  return blsWrapper;
}

before(async function () {  
    await init();
    await depositToWallet(signers);
    await createTestTxs();
    await blsWrapper.postAddresses(
        baseToken.address,
        blsWallet.address
    );
});

describe('BatchServer', async function () {
  beforeEach(async function () {
    await blsWrapper.resetDb();
  });

  it('should query server root', async function () {
    expect(await blsWrapper.getRoot()).to.equal('Post txs to /tx/add.');
  });

  it('should add transactions', async function () {
    await blsWrapper.postTx(0);
    expect(await blsWrapper.getCount()).to.equal(1);
    await blsWrapper.postTx(1);
    expect(await blsWrapper.getCount()).to.equal(2);
  });
});
