import { expect } from "chai";
import { ethers } from "hardhat";

import { parseEther } from "ethers/lib/utils";
import { utils } from "ethers";

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

  describe("ERC20", async function () {
    let mockERC20;
    let tokenSupply;
    this.beforeAll(async function () {
      tokenSupply = utils.parseUnits("1000000");
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      mockERC20 = await MockERC20.deploy("AnyToken", "TOK", tokenSupply);
      await mockERC20.deployed();
      await mockERC20.transfer(await signers[0].getAddress(), tokenSupply);
    });

    it("Test sending ERC20 token from signer zero", async function () {
      const initialBalance = await mockERC20.balanceOf(
        await signers[1].getAddress(),
      );
      expect(initialBalance).to.equal(0);

      // Send mockERC20 to the signer one
      await mockERC20
        .connect(signers[0])
        .transfer(await signers[1].getAddress(), tokenSupply.div(2));

      const newBalance = await mockERC20.balanceOf(
        await signers[1].getAddress(),
      );
      expect(newBalance).to.equal(tokenSupply.div(2));
    });
  });
});
