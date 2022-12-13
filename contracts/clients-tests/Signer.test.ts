import { expect } from "chai";
import { ethers } from "hardhat";

import { parseEther } from "ethers/lib/utils";
import { utils } from "ethers";

// After the Signer/Provider work is done, we should
// swap these out with BLS signers.
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

describe("Signer tests", async function () {
  let fundedSigners;
  let signers;
  let provider;

  this.beforeAll(async function () {
    fundedSigners = await ethers.getSigners();
    signers = getRandomSigners(5);
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

  describe("ERC721", async function () {
    let mockERC721;

    this.beforeAll(async function () {
      const MockERC721 = await ethers.getContractFactory("MockERC721");
      mockERC721 = await MockERC721.deploy("AnyNFT", "NFT");
      await mockERC721.deployed();
    });

    it("safeMint() call", async function () {
      const nftUri = "ipfs://test.url/";
      const mint = await mockERC721
        .connect(signers[0])
        .safeMint(signers[1].address, nftUri);
      mint.wait();

      expect(await mockERC721.totalSupply()).to.equal(1);
    });

    it("balanceOf() call", async function () {
      // Mint some tokens to signer[2]
      const nftUri = "ipfs://test.url/";
      const mint = await mockERC721
        .connect(signers[0])
        .safeMint(signers[2].address, nftUri);
      mint.wait();

      // Check getting address from signer and passing it to a balanceOf call
      expect(await mockERC721.balanceOf(signers[2].address)).to.equal(1);
    });

    it("transfer() call", async function () {
      // Mint a token to signer[3]
      const nftUri = "ipfs://test.url/";
      const mint = await mockERC721
        .connect(signers[0])
        .safeMint(signers[3].address, nftUri);
      mint.wait();
      const receipt = await provider.getTransactionReceipt(mint.hash);
      const tokenId = receipt.logs[0].topics[3]; // This is the tokenID

      // Check signer[3] owns the token
      expect(await mockERC721.ownerOf(tokenId)).to.equal(signers[3].address);

      // Transfer the token from signer 3 to signer 2
      await mockERC721
        .connect(signers[3])
        .transferFrom(signers[3].address, signers[2].address, tokenId);

      // Check signer[2] now owns the token
      expect(await mockERC721.ownerOf(tokenId)).to.equal(signers[2].address);
    });

    it("approve() call", async function () {
      // Mint a token to signer[4]
      const nftUri = "ipfs://test.url/";
      const mint = await mockERC721
        .connect(signers[0])
        .safeMint(signers[4].address, nftUri);
      mint.wait();
      const receipt = await provider.getTransactionReceipt(mint.hash);
      const tokenId = receipt.logs[0].topics[3]; // This is the tokenID

      // Approve the token for signer[1] address
      await mockERC721.connect(signers[4]).approve(signers[1].address, tokenId);

      // Check signer[1]'s address is now an approved address for the token
      expect(await mockERC721.getApproved(tokenId)).to.equal(
        signers[1].address,
      );
    });
  });
});
