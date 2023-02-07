/* eslint-disable camelcase */
import { expect } from "chai";
import { ethers } from "hardhat";
import { VLQ, VLQ__factory } from "../typechain-types";

describe("vlq", function () {
  let vlq: VLQ;

  this.beforeAll(async () => {
    const [eoa] = await ethers.getSigners();
    const factory = new VLQ__factory(eoa);
    vlq = await factory.deploy();
  });

  it("decodes VLQs", async () => {
    const { result, bytesRead } = await vlq.decode("0x8203");
    expect(result).to.eq(259); // = 2 * 128^1 + 3 * 128^0
    expect(bytesRead).to.eq(2);
  });
});
