import { expect } from "chai";

import { ethers } from "hardhat";
import { SafeSingletonFactory } from "../clients/src";
import { MockERC20__factory as MockERC20Factory } from "../typechain-types";

describe("SafeSingletonFactory", async () => {
  it("should deploy SafeSingletonFactory to expected address", async () => {
    const [signer] = await ethers.getSigners();
    const singletonFactory = await SafeSingletonFactory.init(signer);
    const factoryCode = ethers.provider.getCode(singletonFactory.address);

    expect(factoryCode).not.to.equal("0x");
  });

  it("should deploy to calculated (create2) address", async () => {
    const [signer] = await ethers.getSigners();
    const singletonFactory = await SafeSingletonFactory.init(signer);

    const expectedAddress = singletonFactory.calculateAddress(
      MockERC20Factory,
      ["TestToken123", "TOK", 0],
    );

    expect(await ethers.provider.getCode(expectedAddress)).to.equal("0x");

    await singletonFactory.connectOrDeploy(MockERC20Factory, [
      "TestToken123",
      "TOK",
      0,
    ]);

    expect(await ethers.provider.getCode(expectedAddress)).not.to.equal("0x");
  });

  it("should not do any transactions if contract is already deployed", async () => {
    const [signer] = await ethers.getSigners();
    const singletonFactory = await SafeSingletonFactory.init(signer);

    await singletonFactory.connectOrDeploy(MockERC20Factory, [
      "TestToken123",
      "TOK",
      0,
    ]);

    const txCount = await signer.getTransactionCount();

    // Deploy the same contract (with the same salt (defaults to 0))
    await singletonFactory.connectOrDeploy(MockERC20Factory, [
      "TestToken123",
      "TOK",
      0,
    ]);

    const newTxCount = await signer.getTransactionCount();

    expect(newTxCount).to.equal(txCount);
  });
});
