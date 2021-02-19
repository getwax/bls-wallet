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

  // prepare library for bls keypair generation
  await mcl.init();
  blsWrapper = new BLSWrapper(
    DOMAIN,
    "transfer",
    addresses
  );

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

describe('BatchServer', async function () {
  beforeEach(async function () {
    await init();
    await depositToWallet(signers);
    await createTestTxs();
  });

  it('should query server root', async function () {
    expect(await blsWrapper.getRoot()).to.equal('Post txs to /tx/add.');
  });

  it('should add transactions', async function () {
    await blsWrapper.postTx(0);
    //expect
  });
});

describe('BLSWallet', async function () {
  
  beforeEach(init);

  it('should deposit balance from token to bls wallet', async function () {
    await blsWallet.connect(signers[1]).deposit(blsWrapper.pubKeyForIndex(1), userStartAmount);
    expect(await blsWallet.balanceOf(addresses[1])).to.equal(userStartAmount);
  });

  it('should set bls public key on deposit', async function () {
    const INDEX = 1;
    await blsWallet.connect(signers[INDEX]).deposit(blsWrapper.pubKeyForIndex(INDEX), userStartAmount);
    let hexArray = blsWrapper.pubKeyForIndex(INDEX);
    expect(await blsWallet.blsPubKeyOf(addresses[INDEX])).to.deep.equal(hexArray.map(n => BigNumber.from(n)));
  });

  it('should withdraw full balance from token to bls wallet', async function () {
    await blsWallet.connect(signers[1]).withdraw();
    expect(await blsWallet.balanceOf(addresses[1])).to.equal(0);
  });

  it('should reset bls public key on withdraw', async function () {
    await blsWallet.connect(signers[1]).withdraw();
    expect(await blsWallet.blsPubKeyOf(addresses[1])).to.eql(zeroBLSPubKey);
  });

    //TODO
  // it("should process single", async function() {
  //   const INDEX = 1;
  //   await blsWallet.connect(signers[INDEX]).deposit(mcl.g2ToHex(keyPairs[INDEX].pubkey), userStartAmount);
  //   const account1Balance = await blsWallet.balanceOf(addresses[INDEX]);

  // });

  it("should process multiple transfers", async function() {
    await depositToWallet(signers);
    const testTxs:BLSWrapper = createTestTxs();
    
    
    let recipients = [];
    let amounts = [];
    const n = addresses.length;
    for (let i=0; i<n; i++) {
      const params = testTxs.paramSets[i];
      recipients.push(params[0]);
      amounts.push(params[1]);
    }

    const aggSignature = mcl.g1ToHex(mcl.aggregateRaw(testTxs.signatures));
    let tx = await blsWallet.transferBatch(
      aggSignature,
      addresses,
      testTxs.messages,
      recipients,
      amounts
    );
    await tx.wait();

    expect(await blsWallet.balanceOf(addresses[0])).to.equal(0);
    expect(await blsWallet.balanceOf(addresses[n-1])).to.equal(userStartAmount.mul(n));
  });

  // TODO: test multiple txs from same address

});
