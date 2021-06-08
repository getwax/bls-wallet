import { expect, assert } from "chai";

import { expectEvent, expectRevert } from "@openzeppelin/test-helpers";

import Fixture from "./helpers/Fixture";
import TokenHelper from "./helpers/TokenHelper";

import { aggregate } from "./lib/hubble-bls/src/signer";

describe('TokenPayments', async function () {
  let fx: Fixture;
  let th: TokenHelper;
  beforeEach(async function() {
    fx = await Fixture.create();
  });

  it("should reward tx submitter", async function() {
    let blsWalletAddresses = await fx.createBLSWallets();
    th = new TokenHelper(fx);
    let testToken = await TokenHelper.setupTestToken();
    //TODO
  });
});
