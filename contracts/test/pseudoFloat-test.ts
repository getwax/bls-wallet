/* eslint-disable camelcase */

import { expect } from "chai";
import { ethers } from "hardhat";
import { PseudoFloat, PseudoFloat__factory } from "../typechain-types";

describe("PseudoFloat", function () {
  let pseudoFloat: PseudoFloat;

  this.beforeAll(async () => {
    const [eoa] = await ethers.getSigners();
    const factory = new PseudoFloat__factory(eoa);
    pseudoFloat = await factory.deploy();
  });

  it("0x00 -> 0", async () => {
    const [value, stream] = await pseudoFloat.decodePublic("0x00");
    expect(value).to.eq(0);
    expect(stream).to.eq("0x");
  });

  it("0x7b0f -> 0.0123 ETH", async () => {
    const [value, stream] = await pseudoFloat.decodePublic("0x7b0f");
    expect(ethers.utils.formatEther(value)).to.eq("0.0123");
    expect(stream).to.eq("0x");
  });

  it("0x55b4d7c27d -> 0.883887085 ETH", async () => {
    const [value, stream] = await pseudoFloat.decodePublic("0x55b4d7c27d");
    expect(ethers.utils.formatEther(value)).to.eq("0.883887085");
    expect(stream).to.eq("0x");
  });
});
