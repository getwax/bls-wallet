import { expect, assert } from "chai";

import { ethers, network } from "hardhat";

import { BigNumber, Signer, Contract, ContractFactory, getDefaultProvider } from "ethers";
const utils = ethers.utils;

// import * as mcl from "../server/src/lib/hubble-bls/src/mcl";

import { BlsSignerFactory, BlsSignerInterface, aggregate } from "./lib/hubble-bls/src/signer";
import { keccak256, arrayify, Interface, Fragment, ParamType } from "ethers/lib/utils";

import { expectEvent, expectRevert } from "@openzeppelin/test-helpers";
import Fixture from "./helpers/Fixture";

let th: TokenHelper;

describe('VerificationGateway', async function () {
  let fx: Fixture;
  beforeEach(async function() {
    fx = await Fixture.create();
  });

  it('should register new wallet', async function () {
    let blsSigner = fx.blsSigners[0];  
    let walletAddress = await fx.createBLSWallet(blsSigner);

    let blsWallet = fx.BLSWallet.attach(walletAddress);
    expect(await blsWallet.publicKeyHash())
      .to.equal(Fixture.blsKeyHash(blsSigner));

    // Check revert when adding same wallet twice
    await expectRevert.unspecified(fx.createBLSWallet(blsSigner));

  });

  it("should process individual calls", async function() {
    th = new TokenHelper(fx);
    let blsWalletAddresses = await th.walletTokenSetup();

    // check each wallet has start amount
    for (let i = 0; i<blsWalletAddresses.length; i++) {
      let walletBalance = await th.testToken.balanceOf(blsWalletAddresses[i]);
      expect(walletBalance).to.equal(TokenHelper.userStartAmount);
    }

    console.log("Send between wallets...");
    // bls transfer each wallet's balance to first wallet
    for (let i = 0; i<blsWalletAddresses.length; i++) {
      await th.transferFrom(
        await fx.BLSWallet.attach(blsWalletAddresses[i]).nonce(),
        fx.blsSigners[i],
        blsWalletAddresses[0],
        TokenHelper.userStartAmount
      );
    }

    // check first wallet full and others empty
    let totalAmount = TokenHelper.userStartAmount.mul(blsWalletAddresses.length);
    for (let i = 0; i<blsWalletAddresses.length; i++) {
      let walletBalance = await th.testToken.balanceOf(blsWalletAddresses[i]);
      expect(walletBalance).to.equal(i==0?totalAmount:0);
    }
  });

  it("should process multiple transfers", async function() {
    th = new TokenHelper(fx);
    let blsWalletAddresses = await th.walletTokenSetup();

    // encode transfer of start amount to first wallet
    let encodedFunction = th.testToken.interface.encodeFunctionData(
      "transfer",
      [blsWalletAddresses[0], TokenHelper.userStartAmount.toString()]
    );

    let signatures: any[] = new Array(blsWalletAddresses.length);
    for (let i = 0; i<blsWalletAddresses.length; i++) {
      let dataToSign = fx.dataPayload(
        await fx.BLSWallet.attach(blsWalletAddresses[i]).nonce(),
        th.testToken.address,
        encodedFunction
      );
      signatures[i] = fx.blsSigners[i].sign(dataToSign);
    }

    // each bls wallet to sign same transfer data
    // let signatures = blsSigners.map(b => b.sign(dataToSign));
    let aggSignature = aggregate(signatures);

    // can be called by any ecdsa wallet
    await(await fx.blsExpander.blsCallMultiSameContractFunctionParams(
      Array(signatures.length).fill(0),
      fx.blsSigners.map(Fixture.blsKeyHash),
      aggSignature,
      th.testToken.address,
      encodedFunction.substring(0,10),
      '0x'+encodedFunction.substr(10)
    )).wait();
    // let length = signatures.length;
    // await verificationGateway.blsCallMany(
    //   Array(length).fill(0),
    //   blsSigners.map(blsKeyHash), // corresponding bls signers
    //   aggSignature,
    //   Array(length).fill(testToken.address), // call to same contract
    //   Array(length).fill(encodedFunction.substring(0,10)), // same function
    //   Array(length).fill('0x'+encodedFunction.substr(10)) // same params
    // );

    let totalAmount = TokenHelper.userStartAmount.mul(blsWalletAddresses.length);
    for (let i = 0; i<blsWalletAddresses.length; i++) {
      let walletBalance = await th.testToken.balanceOf(blsWalletAddresses[i]);
      expect(walletBalance).to.equal(i==0?totalAmount:0);
    }
  });

  it("should airdrop", async function() {

    let blsWalletAddresses = await fx.createBLSWallets();
    th = new TokenHelper(fx);
    let testToken = await TokenHelper.setupTestToken();

    // send all to first address
    console.log("Send tokens to first bls wallet");
    let totalAmount = TokenHelper.userStartAmount.mul(blsWalletAddresses.length);
    await(await testToken.connect(fx.signers[0]).transfer(
      blsWalletAddresses[0],
      totalAmount
    )).wait();

    let signatures: any[] = new Array(blsWalletAddresses.length);
    let encodedParams: string[] = new Array(blsWalletAddresses.length);
    let nonce = await fx.BLSWallet.attach(blsWalletAddresses[0]).nonce();
    for (let i = 0; i<blsWalletAddresses.length; i++) {
      // encode transfer of start amount to each wallet
      let encodedFunction = testToken.interface.encodeFunctionData(
        "transfer",
        [blsWalletAddresses[i], TokenHelper.userStartAmount.toString()]
      );
      encodedParams[i] = '0x'+encodedFunction.substr(10);

      let dataToSign = fx.dataPayload(
        nonce++,
        testToken.address,
        encodedFunction
      );
      signatures[i] = fx.blsSigners[0].sign(dataToSign);
    }

    let aggSignature = aggregate(signatures);

    console.log("Airdrop");
    await(await fx.blsExpander.blsCallMultiSameCallerContractFunction(
      Array(signatures.length).fill(0),
      Fixture.blsKeyHash(fx.blsSigners[0]),
      aggSignature,
      testToken.address,
      testToken.interface.getSighash("transfer"),
      encodedParams
    )).wait();

    for (let i = 0; i<blsWalletAddresses.length; i++) {
      let walletBalance = await testToken.balanceOf(blsWalletAddresses[i]);
      expect(walletBalance).to.equal(TokenHelper.userStartAmount);
    }

  });

});


// Helpers

class TokenHelper {

  static readonly initialSupply = ethers.utils.parseUnits("1000000")
  static readonly userStartAmount = TokenHelper.initialSupply.div(Fixture.ACCOUNTS_LENGTH);

  testToken: Contract;
  constructor(public fx: Fixture) {}

  static async setupTestToken(): Promise<Contract> {
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    let mockERC20 = await MockERC20.deploy(
      "AnyToken",
      "TOK",
      TokenHelper.initialSupply
    );
    await mockERC20.deployed();
    return mockERC20;
  }

  static async distributeTokens(
    fromSigner: Signer,
    token: Contract,
    addresses: string[]
  ) {
    console.log("Distribute tokens to wallets...");
    // split supply amongst bls wallet addresses
    for (let i = 0; i<addresses.length; i++) {
      // first account as aggregator, and holds token supply
      await (await token.connect(fromSigner).transfer(
        addresses[i],
        TokenHelper.userStartAmount
      )).wait();
    }
  }

  async walletTokenSetup(): Promise<string[]> {
    let blsWalletAddresses = await this.fx.createBLSWallets();

    this.testToken = await TokenHelper.setupTestToken();
    await TokenHelper.distributeTokens(
      this.fx.signers[0],
      this.testToken,
      blsWalletAddresses
    );

    return blsWalletAddresses;
  }

  async transferFrom(
    nonce: any,
    sender: BlsSignerInterface,
    recipient: string,
    amount: BigNumber
  ) {
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    let encodedFunction = MockERC20.interface.encodeFunctionData(
      "transfer",
      [recipient, amount.toString()]
    );
    await this.fx.gatewayCall(
      sender,
      nonce,
      this.testToken.address,
      encodedFunction
    );
  }
}