/* eslint-disable camelcase */
import { ethers } from "hardhat";
import {
  BLSExpanderDelegator,
  BLSExpanderDelegator__factory,
} from "../typechain-types";

describe("expander", function () {
  let expander: BLSExpanderDelegator;

  this.beforeAll(async () => {
    const [eoa] = await ethers.getSigners();
    const factory = new BLSExpanderDelegator__factory(eoa);
    expander = await factory.deploy();
  });

  it("decodes VLQs", async () => {
    await expander.run("0x8302"); // 259 = 3 + 2 * 128
  });
});
