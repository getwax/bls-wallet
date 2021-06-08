import { ethers, network } from "hardhat";

import { expect, assert } from "chai";

import { expectEvent, expectRevert } from "@openzeppelin/test-helpers";

import Fixture from "./helpers/Fixture";
import TokenHelper from "./helpers/TokenHelper";

import { aggregate } from "./lib/hubble-bls/src/signer";


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

  it("should reward tx submitter", async function() {
    const reward = ethers.utils.parseUnits("10");

    let blsSigner = fx.blsSigners[0];
    const blsPubKeyHash = Fixture.blsKeyHash(blsSigner);

    let encodedFunction = fx.VerificationGateway.interface.encodeFunctionData(
      "walletCrossCheck",
      [blsPubKeyHash]
    );
    let balanceBefore = await th.testToken.balanceOf(blsWalletAddresses[0]);

    await fx.gatewayCall(
      reward,
      blsSigner,
      1, //next nonce after creation
      fx.verificationGateway.address,
      encodedFunction
    );
    let walletBalance = await th.testToken.balanceOf(blsWalletAddresses[0]);
    expect(walletBalance).to.equal(TokenHelper.userStartAmount.sub(reward));
  });

});
