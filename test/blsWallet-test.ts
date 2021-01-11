import { expect, assert } from "chai";
import { BigNumber, Signer, Contract } from "ethers";
import { ethers } from "hardhat";
import { contractOptions } from "web3/eth/contract";
const utils = ethers.utils;

import * as mcl from "../lib/hubble-contracts/ts/mcl";
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

const acc1BLSPubKey = [0xAA, 0xBB, 0xCC, 0xDD].map((n) => { return BigNumber.from(n) });
const acc2BLSPubKey = [0xEE, 0xFF, 0x00, 0x11].map((n) => { return BigNumber.from(n) });
const zeroBLSPubKey = [0, 0, 0, 0].map((n) => { return BigNumber.from(n) });

const initialSupply = ethers.utils.parseUnits("1000000")
const userStartAmount = initialSupply.div(2);

describe('BLSWallet', async function () {
  let admin: Signer, account1: Signer, account2: Signer;
  let address1: string, address2: string;

  let baseToken: Contract, blsWallet: Contract;

  beforeEach(async function () {
    await mcl.init();
    
    [admin, account1, account2] = await ethers.getSigners();
    address1 = await account1.getAddress();
    address2 = await account2.getAddress();

    // setup erc20 token and account balances
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    baseToken = await MockERC20.deploy("AnyToken","TOK", initialSupply);
    await baseToken.deployed();
    await baseToken.transfer(address1, userStartAmount);
    await baseToken.transfer(address2, userStartAmount);

    // deploy bls wallet with token address
    const BLSWallet = await ethers.getContractFactory("MockBLSWallet");
    blsWallet = await BLSWallet.deploy(baseToken.address);
    await blsWallet.deployed();

    // approve bls wallet with amount to transfer
    await baseToken.connect(account1).approve(blsWallet.address, userStartAmount);
    await baseToken.connect(account2).approve(blsWallet.address, userStartAmount);
  });

  it("verify aggregated signature", async function() {
    const n = 10;
    const messages = [];
    const pubkeys = [];
    const signatures = [];
    for (let i = 0; i < n; i++) {
        const message = randHex(12);
        const { pubkey, secret } = mcl.newKeyPair();
        const { signature, messagePoint } = mcl.sign(
            message,
            secret,
            DOMAIN
        );
        messages.push(mcl.g1ToHex(messagePoint));
        pubkeys.push(mcl.g2ToHex(pubkey));
        signatures.push(signature);
    }
    const aggSignature = mcl.g1ToHex(mcl.aggregateRaw(signatures));
    const res = await blsWallet.transferBatch(aggSignature, pubkeys, messages);
    assert.isTrue(res[0]);
    assert.isTrue(res[1]);
});

  it('should deposit balance from token to bls wallet', async function () {
    await blsWallet.connect(account1).deposit(acc1BLSPubKey, userStartAmount);
    expect(await blsWallet.balanceOf(address1)).to.equal(userStartAmount);
  });

  it('should set bls public key on deposit', async function () {
    await blsWallet.connect(account1).deposit(acc1BLSPubKey, userStartAmount);
    expect(await blsWallet.blsPubKeyOf(address1)).to.eql(acc1BLSPubKey);
  });

  it('should withdraw full balance from token to bls wallet', async function () {
    await blsWallet.connect(account1).withdraw();
    expect(await blsWallet.balanceOf(address1)).to.equal(0);
  });

  it('should reset bls public key on withdraw', async function () {
    await blsWallet.connect(account1).withdraw();
    expect(await blsWallet.blsPubKeyOf(address1)).to.eql(zeroBLSPubKey);
  });

});
