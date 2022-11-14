import { expect } from "chai";
import { ethers } from "hardhat";

import { parseEther } from "ethers/lib/utils";

describe("Signer test", async function () {
  let signers;
  let provider;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    provider = ethers.provider;
  });

  it("Test a send ETH transaction", async function () {
    const walletBalanceBefore = await provider.getBalance(
      await signers[1].getAddress(),
    );
    const ethToTransfer = parseEther("0.0001");

    await signers[0].sendTransaction({
      to: await signers[1].getAddress(),
      value: ethToTransfer,
    });

    const walletBalanceAfter = await provider.getBalance(
      await signers[1].getAddress(),
    );
    expect(walletBalanceAfter.sub(walletBalanceBefore)).to.equal(ethToTransfer);
  });
});
