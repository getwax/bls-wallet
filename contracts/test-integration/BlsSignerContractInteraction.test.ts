import { expect } from "chai";
import { ethers } from "hardhat";
import { parseEther } from "ethers/lib/utils";
import { BigNumber, utils, Wallet } from "ethers";

import { Experimental } from "../clients/src";
import getNetworkConfig from "../shared/helpers/getNetworkConfig";

async function getRandomSigners(
  numSigners: number,
): Promise<typeof Experimental.BlsSigner[]> {
  const networkConfig = await getNetworkConfig("local");

  const aggregatorUrl = "http://localhost:3000";
  const verificationGateway = networkConfig.addresses.verificationGateway;
  const rpcUrl = "http://localhost:8545";
  const network = {
    name: "localhost",
    chainId: 0x7a69,
  };

  const signers = [];
  for (let i = 0; i < numSigners; i++) {
    const privateKey = ethers.Wallet.createRandom().privateKey;
    const blsProvider = new Experimental.BlsProvider(
      aggregatorUrl,
      verificationGateway,
      rpcUrl,
      network,
    );
    const blsSigner = blsProvider.getSigner(privateKey);
    signers.push(blsSigner);
  }
  return signers;
}

describe("Signer contract interaction tests", function () {
  let blsSigners;
  let fundedWallet: Wallet;

  this.beforeAll(async function () {
    fundedWallet = new ethers.Wallet(
      "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", // HH Account #4
      new ethers.providers.JsonRpcProvider("http://localhost:8545"),
    );
    blsSigners = await getRandomSigners(5);

    const fundSigner = async (signer) => {
      const tx = await fundedWallet.sendTransaction({
        to: await signer.getAddress(),
        value: parseEther("100"),
      });
      await tx.wait();
    };

    // Give all signers some Ether
    for (let i = 0; i < blsSigners.length; i++) {
      await fundSigner(blsSigners[i]);
    }
  });

  describe("ERC20", async function () {
    let mockERC20;
    let tokenSupply: BigNumber;

    this.beforeAll(async function () {
      tokenSupply = utils.parseUnits("1000000");
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      mockERC20 = await MockERC20.connect(fundedWallet).deploy(
        "AnyToken",
        "TOK",
        tokenSupply,
      );
      await mockERC20.deployed();

      await mockERC20.transfer(await blsSigners[0].getAddress(), tokenSupply);
    });

    it("balanceOf() call", async function () {
      const initialBalance = await mockERC20.balanceOf(
        await blsSigners[0].getAddress(),
      );
      expect(initialBalance).to.equal(tokenSupply);
    });

    it("calls balanceOf successfully after instantiating Contract class with BlsSigner", async function () {
      const blsSignerAddress = await blsSigners[0].getAddress();
      const ERC20 = new ethers.Contract(
        mockERC20.address,
        mockERC20.interface,
        blsSigners[0],
      );
      expect(await ERC20.signer.getAddress()).to.equal(blsSignerAddress);

      const initialBalance = await ERC20.balanceOf(blsSignerAddress);
      expect(initialBalance).to.equal(tokenSupply);
    });

    it("transfer() call", async function () {
      const recipient = await blsSigners[1].getAddress();

      const tx = await mockERC20
        .connect(blsSigners[0])
        .transfer(recipient, tokenSupply.div(2));
      await tx.wait();

      const newReceipientBalance = await mockERC20.balanceOf(recipient);
      expect(newReceipientBalance).to.equal(tokenSupply.div(2));
    });

    it("approve() and transferFrom() calls", async function () {
      const owner = await blsSigners[0].getAddress();
      const spender = await blsSigners[1].getAddress();

      const initialBalance = await mockERC20.balanceOf(spender);
      const erc20ToTransfer = parseEther("11.0");

      const txApprove = await mockERC20
        .connect(blsSigners[0])
        .approve(spender, erc20ToTransfer);
      await txApprove.wait();

      const txTransferFrom = await mockERC20
        .connect(blsSigners[1])
        .transferFrom(owner, spender, erc20ToTransfer);
      await txTransferFrom.wait();

      const newBalance = await mockERC20.balanceOf(spender);
      expect(newBalance.sub(initialBalance)).to.equal(erc20ToTransfer);
    });
  });

  describe("ERC721", async function () {
    let mockERC721;

    this.beforeAll(async function () {
      const MockERC721 = await ethers.getContractFactory("MockERC721");
      mockERC721 = await MockERC721.connect(fundedWallet).deploy(
        "AnyNFT",
        "NFT",
      );
      await mockERC721.deployed();
    });

    // TODO: Investigate why safeMint() fails with a BLS wallet address
    it("safeMint() call fails with BLS wallet address", async function () {
      const recipient = await blsSigners[1].getAddress();
      const tokenId = 100;

      const mint = await mockERC721
        .connect(blsSigners[0])
        .safeMint(recipient, tokenId);
      await mint.wait();

      const ownerOfTx = async () => {
        await mockERC721.connect(blsSigners[1]).ownerOf(tokenId);
      };
      expect(ownerOfTx()).to.be.rejectedWith(Error, "ERC721: invalid token ID");
    });

    it("safeMint() call passes with EOA address", async function () {
      const recipient = ethers.Wallet.createRandom().address;
      const tokenId = 1;

      const mint = await mockERC721
        .connect(blsSigners[0])
        .safeMint(recipient, tokenId);
      await mint.wait();

      // ERC721: invalid token ID
      expect(await mockERC721.connect(blsSigners[1]).ownerOf(tokenId)).to.equal(
        recipient,
      );
    });

    it("mint() call", async function () {
      const recipient = await blsSigners[1].getAddress();
      const tokenId = 2;

      const mint = await mockERC721
        .connect(blsSigners[0])
        .mint(recipient, tokenId);
      await mint.wait();

      expect(await mockERC721.connect(blsSigners[1]).ownerOf(tokenId)).to.equal(
        recipient,
      );
    });

    it("balanceOf() call", async function () {
      const recipient = await blsSigners[1].getAddress();
      const initialBalance = await mockERC721.balanceOf(recipient);
      const tokenId = 3;

      const mint = await mockERC721
        .connect(blsSigners[0])
        .mint(recipient, tokenId);
      await mint.wait();

      expect(
        (await mockERC721.balanceOf(recipient)).sub(initialBalance),
      ).to.equal(1);
    });

    it("transfer() call", async function () {
      const tokenId = 4;
      const owner = await blsSigners[3].getAddress();
      const recipient = await blsSigners[2].getAddress();

      // Mint a token to signer[3]
      const mint = await mockERC721.connect(blsSigners[0]).mint(owner, tokenId);
      await mint.wait();

      // Check signer[3] owns the token
      expect(await mockERC721.ownerOf(tokenId)).to.equal(owner);

      // Transfer the token from signer 3 to signer 2
      const transfer = await mockERC721
        .connect(blsSigners[3])
        .transferFrom(owner, recipient, tokenId);
      await transfer.wait();

      // Check signer[2] now owns the token
      expect(await mockERC721.ownerOf(tokenId)).to.equal(recipient);
    });

    it("approve() call", async function () {
      const owner = await blsSigners[4].getAddress();
      const spender = await blsSigners[1].getAddress();

      // Mint a token to signer[4]
      const tokenId = 5;
      const mint = await mockERC721
        .connect(blsSigners[0])
        .safeMint(owner, tokenId);
      await mint.wait();

      // Approve the token for signer[1] address
      const approve = await mockERC721
        .connect(blsSigners[4])
        .approve(spender, tokenId);
      await approve.wait();

      // Check signer[1]'s address is now an approved address for the token
      expect(await mockERC721.getApproved(tokenId)).to.equal(spender);
    });
  });
});
