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

const zeroBLSPubKey = [0, 0, 0, 0].map(n => BigNumber.from(n));

const initialSupply = ethers.utils.parseUnits("1000000")

describe('BLSWallet', async function () {
  const ACCOUNTS_LENGTH = 3;
  let signers: Signer[];
  let addresses: string[];
  let keyPairs: keyPair[];
  
  const userStartAmount = initialSupply.div(ACCOUNTS_LENGTH);

  let baseToken: Contract, blsWallet: Contract;

  beforeEach(async function () {
    signers = (await ethers.getSigners()).slice(0, ACCOUNTS_LENGTH);
    addresses = await Promise.all(signers.map(acc => acc.getAddress()));
    keyPairs = [];

    // setup erc20 token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    baseToken = await MockERC20.deploy("AnyToken","TOK", initialSupply);
    await baseToken.deployed();

    // deploy bls wallet with token address
    const BLSWallet = await ethers.getContractFactory("MockBLSWallet");
    blsWallet = await BLSWallet.deploy(addresses[0], baseToken.address); 
    await blsWallet.deployed();
    
    // prepare library for bls keypair generation
    await mcl.init();
    // split supply amongst addresses, and approve transfer from wallet
    for (let i = 0; i<signers.length; i++) {
      keyPairs.push(mcl.newKeyPair()); // store bls key pair for accounts
      await baseToken.connect(signers[0]).transfer(addresses[i], userStartAmount); // first account as aggregator, and holds token supply
      await baseToken.connect(signers[i]).approve(blsWallet.address, userStartAmount);
    }

  });

  it("verify single signature", async function() {
    const INDEX = 1;
    await blsWallet.connect(signers[INDEX]).deposit(mcl.g2ToHex(keyPairs[INDEX].pubkey), userStartAmount);
    const account1Balance = await blsWallet.balanceOf(addresses[INDEX]);

  });

  it("verify aggregated signature", async function() {
    const n = signers.length;

    for (let i=0; i<n; i++) {
      await blsWallet.connect(signers[i]).deposit(mcl.g2ToHex(keyPairs[i].pubkey), userStartAmount);
    }

    const messages = [];
    const pubkeys = [];
    const signatures = [];
    const recipients = [];
    const amounts = [];
    console.log("From test")
    for (let i = 0; i < n; i++) {
        const recipient = addresses[n-1];
        const amount = userStartAmount.toString();
        let message = utils.keccak256(
          blsWallet.interface.encodeFunctionData(
            "transfer", [recipient, amount]
          )
        );
        console.log("msg", message);
        const { signature, messagePoint } = mcl.sign(
            message,
            keyPairs[i].secret,
            DOMAIN
        );
        messages.push(mcl.g1ToHex(messagePoint));
        console.log("msgPoint", messages[i]);
        pubkeys.push(mcl.g2ToHex(keyPairs[i].pubkey));
        signatures.push(signature);
        recipients.push(recipient);
        amounts.push(amount);
    }

    const aggSignature = mcl.g1ToHex(mcl.aggregateRaw(signatures));
    let tx = await blsWallet.transferBatch(
      aggSignature,
      addresses,
      messages,
      recipients,
      amounts
    );
    await tx.wait();
    let events = await blsWallet.queryFilter(
      await blsWallet.filters.Data()
    );
    expect(events.length).to.equal(n*2);
    console.log("From events...");
    for (let i = 0; i < events.length; i++) {
      console.log(
        events[i].args["info"], "[\n  ",
        events[i].args["value"][0].toHexString(), ",\n  ",
        events[i].args["value"][1].toHexString(), "\n]"
      );
    }

    expect(await blsWallet.balanceOf(addresses[0])).to.equal(0);
    expect(await blsWallet.balanceOf(addresses[n-1])).to.equal(userStartAmount.mul(n));
  });

  it('should deposit balance from token to bls wallet', async function () {
    await blsWallet.connect(signers[1]).deposit(mcl.g2ToHex(keyPairs[1].pubkey), userStartAmount);
    expect(await blsWallet.balanceOf(addresses[1])).to.equal(userStartAmount);
  });

  it('should set bls public key on deposit', async function () {
    const INDEX = 1;
    await blsWallet.connect(signers[INDEX]).deposit(mcl.g2ToHex(keyPairs[INDEX].pubkey), userStartAmount);
    let hexArray = mcl.g2ToHex(keyPairs[INDEX].pubkey);
    // console.log(hexArray);
    // console.log(hexArray.map(n => BigNumber.from(n)));
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

});
