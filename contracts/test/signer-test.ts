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

    const fundSigner = async (signer) => {
      const tx = await fundedSigners[0].sendTransaction({
        to: await signer.getAddress(),
        value: parseEther("1000.0"),
      });
      return tx.wait();
    };

    // Give all signers some Ether
    await Promise.all(
      signers.map((signer) => {
        return fundSigner(signer);
      }),
    );
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

    it("balanceOf() call", async function () {
      const initialBalance = await mockERC20.balanceOf(
        await signers[0].getAddress(),
      );
      expect(initialBalance).to.equal(tokenSupply);
    });

    it("transfer() call", async function () {
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

    it("approve() and transferFrom() calls", async function () {
      const initialBalance = await mockERC20.balanceOf(
        await signers[1].getAddress(),
      );

      const erc20ToTransfer = parseEther("11.0");

      const txApprove = await mockERC20
        .connect(signers[0])
        .approve(
          await signers[1].getAddress(),
          ethers.BigNumber.from(10).pow(18).mul(11),
        );
      txApprove.wait();

      const txTransferFrom = await mockERC20
        .connect(signers[1])
        .transferFrom(
          await signers[0].getAddress(),
          await signers[1].getAddress(),
          ethers.BigNumber.from(10).pow(18).mul(11),
        );
      txTransferFrom.wait();

      const newBalance = await mockERC20.balanceOf(
        await signers[1].getAddress(),
      );
      expect(newBalance.sub(initialBalance)).to.equal(erc20ToTransfer);
    });
  });
});
