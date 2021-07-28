import { expect, assert } from "chai";

import { expectEvent, expectRevert } from "@openzeppelin/test-helpers";

import Fixture from "../shared/helpers/Fixture";
import { TxData } from "../shared/helpers/Fixture";
import TokenHelper from "../shared/helpers/TokenHelper";

import { aggregate } from "../shared/lib/hubble-bls/src/signer";
import { BigNumber, providers } from "ethers";

describe('WalletActions', async function () {
  let fx: Fixture;
  let th: TokenHelper;
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
    // console.log(providers.getNetwork());
    // await expectRevert.unspecified(fx.createBLSWallet(blsSigner));

  });

  it('should check signature', async function () {
    let blsSigner = fx.blsSigners[0];
    await fx.createBLSWallet(blsSigner);
    // let blsWallet = BLSWallet.attach(walletAddress);

    const blsPubKeyHash = Fixture.blsKeyHash(blsSigner);

    let encodedFunction = fx.VerificationGateway.interface.encodeFunctionData(
      "walletCrossCheck",
      [blsPubKeyHash]
    );
  
    let dataToSign = await fx.dataPayload(
      0,
      BigNumber.from(0),
      fx.verificationGateway.address,
      encodedFunction
    );
  
    let signature = blsSigner.sign(dataToSign);
  
    let {result, nextNonce} = await fx.verificationGateway.callStatic.checkSig(
      0,
      BigNumber.from(0),
      blsPubKeyHash,
      signature,
      fx.verificationGateway.address,
      encodedFunction.substring(0,10),
      '0x'+encodedFunction.substr(10)
    );
    expect(result).to.equal(true);
    expect(nextNonce).to.equal(BigNumber.from(1));
  });

  it("should create many wallets", async function() {
    let signatures: any[] = new Array(fx.blsSigners.length);

    let dataToSign = fx.dataPayload(
      0,
      BigNumber.from(0),
      fx.verificationGateway.address,
      fx.encodedCreate
    );
    for (let i = 0; i<fx.blsSigners.length; i++) {
      signatures[i] = fx.blsSigners[i].sign(dataToSign);
    }
    let aggSignature = aggregate(signatures);
    await (await fx.verificationGateway.blsCreateMany(
      Array(signatures.length).fill(0),
      fx.blsSigners.map( s => s.pubkey ),
      aggSignature
    )).wait();
    let publicKeyHash = Fixture.blsKeyHash(fx.blsSigners[0]);
    let blsWalletAddress = await fx.verificationGateway.walletFromHash(publicKeyHash);
    let blsWallet = fx.BLSWallet.attach(blsWalletAddress);
    expect(await blsWallet.gateway())
      .to.equal(fx.verificationGateway.address);
  });

  it("should process individual calls", async function() {
    th = new TokenHelper(fx);
    let blsWalletAddresses = await th.walletTokenSetup();

    // check each wallet has start amount
    for (let i = 0; i<blsWalletAddresses.length; i++) {
      let walletBalance = await th.testToken.balanceOf(blsWalletAddresses[i]);
      expect(walletBalance).to.equal(th.userStartAmount);
    }

    // bls transfer each wallet's balance to first wallet
    for (let i = 0; i<blsWalletAddresses.length; i++) {
      await th.transferFrom(
        await fx.BLSWallet.attach(blsWalletAddresses[i]).nonce(),
        BigNumber.from(0),
        fx.blsSigners[i],
        blsWalletAddresses[0],
        th.userStartAmount
      );
    }

    // check first wallet full and others empty
    let totalAmount = th.userStartAmount.mul(blsWalletAddresses.length);
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
      [blsWalletAddresses[0], th.userStartAmount.toString()]
    );

    let signatures: any[] = new Array(blsWalletAddresses.length);
    for (let i = 0; i<blsWalletAddresses.length; i++) {
      let dataToSign = fx.dataPayload(
        await fx.BLSWallet.attach(blsWalletAddresses[i]).nonce(),
        BigNumber.from(0),
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
      fx.blsSigners.map(Fixture.blsKeyHash),
      aggSignature,
      Array(signatures.length).fill(0),
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

    let totalAmount = th.userStartAmount.mul(blsWalletAddresses.length);
    for (let i = 0; i<blsWalletAddresses.length; i++) {
      let walletBalance = await th.testToken.balanceOf(blsWalletAddresses[i]);
      expect(walletBalance).to.equal(i==0?totalAmount:0);
    }
  });

  it("should airdrop", async function() {
    th = new TokenHelper(fx);

    let blsWalletAddresses = await fx.createBLSWallets();
    let testToken = await TokenHelper.deployTestToken();

    // send all to first address
    let totalAmount = th.userStartAmount.mul(blsWalletAddresses.length);
    await(await testToken.connect(fx.signers[0]).transfer(
      blsWalletAddresses[0],
      totalAmount
    )).wait();

    let signatures: any[] = new Array(blsWalletAddresses.length);
    let encodedParams: string[] = new Array(blsWalletAddresses.length);
    let nonce = await fx.BLSWallet.attach(blsWalletAddresses[0]).nonce();
    let reward = BigNumber.from(0);
    for (let i = 0; i<blsWalletAddresses.length; i++) {
      // encode transfer of start amount to each wallet
      let encodedFunction = testToken.interface.encodeFunctionData(
        "transfer",
        [blsWalletAddresses[i], th.userStartAmount.toString()]
      );
      encodedParams[i] = '0x'+encodedFunction.substr(10);

      let dataToSign = fx.dataPayload(
        nonce++,
        reward,
        testToken.address,
        encodedFunction
      );
      signatures[i] = fx.blsSigners[0].sign(dataToSign);
    }

    let aggSignature = aggregate(signatures);

    await(await fx.blsExpander.blsCallMultiSameCallerContractFunction(
      Fixture.blsKeyHash(fx.blsSigners[0]),
      aggSignature,
      Array(signatures.length).fill(0),
      testToken.address,
      testToken.interface.getSighash("transfer"),
      encodedParams
    )).wait();

    for (let i = 0; i<blsWalletAddresses.length; i++) {
      let walletBalance = await testToken.balanceOf(blsWalletAddresses[i]);
      expect(walletBalance).to.equal(th.userStartAmount);
    }

  });

});

