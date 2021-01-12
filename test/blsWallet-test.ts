import { expect, assert } from "chai";
import { BigNumber, Signer, Contract } from "ethers";
import { ethers } from "hardhat";
import { contractOptions } from "web3/eth/contract";
const utils = ethers.utils;

import * as mcl from "../lib/hubble-contracts/ts/mcl";
import { keyPair } from "../lib/hubble-contracts/ts/mcl";
import { randHex, randFs, to32Hex } from "../lib/hubble-contracts/ts/utils";
import { randomBytes, hexlify, arrayify } from "ethers/lib/utils";
import { expandMsg, hashToField } from "../lib/hubble-contracts/ts/hashToField";

const DOMAIN_HEX = randHex(32);
const DOMAIN = arrayify(DOMAIN_HEX);

const g2PointOnIncorrectSubgroup = [
    "0x1ef4bf0d452e71f1fb23948695fa0a87a10f3d9dce9d32fadb94711f22566fb5",
    "0x237536b6a72ac2e447e7b34a684a81d8e63929a4d670ce1541730a7e03c3f0f2",
    "0x0a63f14620a64dd39394b6e89c48679d3f2ce0c46a1ef052ee3df0bd66c198cb",
    "0x0fe4020ece1b2849af46d308e9f201ac58230a45e124997f52c65d28fe3cf8f1"
];

const zeroBLSPubKey = [0, 0, 0, 0].map((n) => { return BigNumber.from(n) });

const initialSupply = ethers.utils.parseUnits("1000000")

describe('BLSWallet', async function () {
  const ACCOUNTS_LENGTH = 5;
  let signers: Signer[];
  let addresses: string[];
  let keyPairs: keyPair[];
  
  const userStartAmount = initialSupply.div(ACCOUNTS_LENGTH);

  let baseToken: Contract, blsWallet: Contract;

  beforeEach(async function () {
    signers = (await ethers.getSigners()).slice(0, ACCOUNTS_LENGTH);
    addresses = await Promise.all(signers.map((acc) => { return acc.getAddress() }));
    keyPairs = [];

    // setup erc20 token, account balances, and bls key pairs
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    baseToken = await MockERC20.deploy("AnyToken","TOK", initialSupply);
    await baseToken.deployed();

    // deploy bls wallet with token address
    const BLSWallet = await ethers.getContractFactory("MockBLSWallet");
    blsWallet = await BLSWallet.deploy(baseToken.address);
    await blsWallet.deployed();
    
    await mcl.init();
    // split supply amongst addresses, and approve transfer from wallet
    for (let i = 0; i<signers.length; i++) {
      keyPairs.push(mcl.newKeyPair());
      await baseToken.connect(signers[0]).transfer(addresses[i], userStartAmount); // first account holds token supply
      await baseToken.connect(signers[i]).approve(blsWallet.address, userStartAmount);
    }

  });

  it("verify aggregated signature", async function() {
    const n = signers.length;

    for (let i=0; i<n; i++) {
      await blsWallet.connect(signers[i]).deposit(mcl.g2ToHex(keyPairs[i].pubkey), userStartAmount);
    }

    const messages = [];
    const pubkeys = [];
    const signatures = [];
    for (let i = 0; i < n; i++) {
        const message = randHex(12);
        const { signature, messagePoint } = mcl.sign(
            message,
            keyPairs[i].secret,
            DOMAIN
        );
        messages.push(mcl.g1ToHex(messagePoint));
        pubkeys.push(mcl.g2ToHex(keyPairs[i].pubkey));
        signatures.push(signature);
    }

    const aggSignature = mcl.g1ToHex(mcl.aggregateRaw(signatures));
    const res = await blsWallet.transferBatch(aggSignature, addresses, messages);
    assert.isTrue(res[0]);
    assert.isTrue(res[1]);
  });

  it('should deposit balance from token to bls wallet', async function () {
    await blsWallet.connect(signers[1]).deposit(mcl.g2ToHex(keyPairs[1].pubkey), userStartAmount);
    expect(await blsWallet.balanceOf(addresses[1])).to.equal(userStartAmount);
  });

  it('should set bls public key on deposit', async function () {
    await blsWallet.connect(signers[1]).deposit(mcl.g2ToHex(keyPairs[1].pubkey), userStartAmount);
    let hexArray = mcl.g2ToHex(keyPairs[1].pubkey);
    expect(await blsWallet.blsPubKeyOf(addresses[1])).to.eql(hexArray.map((n) => { return BigNumber.from(n) }));
  });

  it('should withdraw full balance from token to bls wallet', async function () {
    await blsWallet.connect(signers[1]).withdraw();
    expect(await blsWallet.balanceOf(addresses[1])).to.equal(0);
  });

  it('should reset bls public key on withdraw', async function () {
    await blsWallet.connect(signers[1]).withdraw();
    expect(await blsWallet.blsPubKeyOf(addresses[1])).to.eql(zeroBLSPubKey);
  });

});
