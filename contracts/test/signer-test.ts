import { expect } from "chai";
import { ethers } from "hardhat";

import { parseEther } from "ethers/lib/utils";
import { utils } from "ethers";

// Would we want to do this?
function getRandomSigners(numSigners: number) {
  const signers = [];
  const provider = ethers.provider;
  for (let i = 0; i < numSigners; i++) {
    const pKey = ethers.Wallet.createRandom().privateKey;
    const wallet = new ethers.Wallet(pKey);
    signers.push(wallet.connect(provider));
  }
  return signers;
}

describe("Signer test", async function () {
  let fundedSigners;
  let signers;
  let provider;

  this.beforeAll(async function () {
    fundedSigners = await ethers.getSigners();
    signers = getRandomSigners(4);
    provider = ethers.provider;

    const tx = await fundedSigners[0].sendTransaction({
      to: await signers[0].getAddress(),
      value: parseEther("1000.0"),
    });
    await tx.wait();
  });

  it("Test a send ETH transaction", async function () {
    const balance = await provider.getBalance(await signers[0].getAddress());
    console.log("signer one balance: ", ethers.utils.formatEther(balance));
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
