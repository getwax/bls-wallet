import { ethers, network } from "hardhat";

import { expect, assert } from "chai";

import { expectEvent, expectRevert } from "@openzeppelin/test-helpers";

import Fixture from "../shared/helpers/Fixture";
import { TxData } from "../shared/helpers/Fixture";
import TokenHelper from "../shared/helpers/TokenHelper";

import { aggregate } from "../shared/lib/hubble-bls/src/signer";
import { BigNumber } from "ethers";
// import { solG1 } from "../shared/lib/hubble-bls/src/mcl";


describe('TokenPayments', async function () {
  let fx: Fixture;
  let th: TokenHelper;
  let blsWalletAddresses: string[];

  beforeEach(async function() {
    fx = await Fixture.create(7, false);
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
    let aggBalanceBefore = await th.testToken.balanceOf(await fx.signers[0].getAddress());
    await fx.gatewayCall(
      blsSigner,
      1, //next nonce after creation
      reward,
      fx.verificationGateway.address,
      encodedFunction
    );
    let walletBalance = await th.testToken.balanceOf(blsWalletAddresses[0]);

    expect(walletBalance).to.equal(th.userStartAmount.sub(reward));
    let aggBalance = await th.testToken.balanceOf(await fx.signers[0].getAddress());
    expect(aggBalance).to.equal(aggBalanceBefore.add(reward));
  });

  it("should reward tx submitter (callMany)", async function() {
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
    let aggBalanceBefore = await th.testToken.balanceOf(firstSigner);
    await(await fx.verificationGateway.blsCallMany(
      firstSigner,
      aggSignature,
      txs
    )).wait();

    let balancesAfter = await Promise.all(blsWalletAddresses.map(a => th.testToken.balanceOf(a)));
    let expectedAfter = th.userStartAmount.sub(reward);
    balancesAfter.map( b => expect(b).to.equal(expectedAfter) );
    let aggBalance = await th.testToken.balanceOf(firstSigner);
    expect(aggBalance).to.equal(aggBalanceBefore.add(reward.mul(blsWalletAddresses.length)));
  });

});
