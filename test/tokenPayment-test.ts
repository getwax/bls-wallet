import { ethers, network } from "hardhat";

import { expect, assert } from "chai";

import { expectEvent, expectRevert } from "@openzeppelin/test-helpers";

import Fixture from "./helpers/Fixture";
import TokenHelper from "./helpers/TokenHelper";

import { aggregate } from "./lib/hubble-bls/src/signer";
import { BigNumber } from "ethers";
import { solG1 } from "./lib/hubble-bls/src/mcl";


describe.only('TokenPayments', async function () {
  let fx: Fixture;
  let th: TokenHelper;
  let blsWalletAddresses: string[];

  beforeEach(async function() {
    fx = await Fixture.create(false);
    th = new TokenHelper(fx);
    blsWalletAddresses = await th.walletTokenSetup();
    await fx.verificationGateway.initialize(th.testToken.address);
  });

  it("should reward tx submitter (single call)", async function() {
    const reward = ethers.utils.parseUnits("10");

    let blsSigner = fx.blsSigners[0];
    const blsPubKeyHash = Fixture.blsKeyHash(blsSigner);

    let encodedFunction = fx.VerificationGateway.interface.encodeFunctionData(
      "walletCrossCheck",
      [blsPubKeyHash]
    );
    let balanceBefore = await th.testToken.balanceOf(blsWalletAddresses[0]);

    await fx.gatewayCall(
      blsSigner,
      1, //next nonce after creation
      reward,
      fx.verificationGateway.address,
      encodedFunction
    );
    let walletBalance = await th.testToken.balanceOf(blsWalletAddresses[0]);
    expect(walletBalance).to.equal(TokenHelper.userStartAmount.sub(reward));
    let aggBalance = await th.testToken.balanceOf(await fx.signers[0].getAddress());
    expect(aggBalance).to.equal(reward);
  });

  type TxData = {
    publicKeyHash: any;
    tokenRewardAmount: BigNumber;
    contractAddress: string;
    methodID: string;
    encodedParams: string;
  }

  it.only("should reward tx submitter (callMany)", async function() {
    const reward = ethers.utils.parseUnits("10");

    let txs: TxData[] = new Array(blsWalletAddresses.length);
    let signatures: any[] = new Array(blsWalletAddresses.length);

    let sigHash = fx.VerificationGateway.interface.getSighash("walletCrossCheck");

    for (let i = 0; i<blsWalletAddresses.length; i++) {
      let publicKeyHash = Fixture.blsKeyHash(fx.blsSigners[i]);
      let encodedFunction = fx.VerificationGateway.interface.encodeFunctionData(
        "walletCrossCheck",
        [publicKeyHash]
      );
      let dataToSign = fx.dataPayload(
        await fx.BLSWallet.attach(blsWalletAddresses[i]).nonce(),
        reward,
        fx.verificationGateway.address,
        encodedFunction
      );

      txs[i] = {
        publicKeyHash: publicKeyHash,
        tokenRewardAmount: reward,
        contractAddress: fx.verificationGateway.address,
        methodID: sigHash,
        encodedParams: '0x'+encodedFunction.substr(10)
      }
      signatures[i] = fx.blsSigners[i].sign(dataToSign);
    }

    let aggSignature = aggregate(signatures);

    // let sigHash = fx.VerificationGateway.interface.getSighash("walletCrossCheck");
    // await(await fx.blsExpander.blsCallMultiSameContract(
    //   keyHashes,
    //   aggSignature,
    //   Array(signatures.length).fill(reward),
    //   fx.verificationGateway.address,
    //   Array(signatures.length).fill(sigHash),
    //   encodedParams
    // )).wait();

    let firstSigner = await fx.signers[0].getAddress();
    await(await fx.verificationGateway.blsCallManyStruct(
      firstSigner,
      aggSignature,
      txs
    )).wait();

    let balancesAfter = await Promise.all(blsWalletAddresses.map(a => th.testToken.balanceOf(a)));
    let expectedAfter = TokenHelper.userStartAmount.sub(reward);
    balancesAfter.map( b => expect(b).to.equal(expectedAfter) );
    let aggBalance = await th.testToken.balanceOf(firstSigner);
    expect(aggBalance).to.equal(reward.mul(blsWalletAddresses.length));
  });

});
