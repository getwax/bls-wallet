/* eslint-disable camelcase */

import { expect } from "chai";
import { ethers } from "hardhat";
import { RegIndex, RegIndex__factory } from "../typechain-types";

describe("RegIndex", function () {
  let regIndex: RegIndex;

  this.beforeAll(async () => {
    const [eoa] = await ethers.getSigners();
    const factory = new RegIndex__factory(eoa);
    regIndex = await factory.deploy();
  });

  it("0x000000 -> 0", async () => {
    const [value, stream] = await regIndex.decodePublic("0x000000");
    expect(value).to.eq(0);
    expect(stream).to.eq("0x");
  });
});
