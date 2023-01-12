import { expect } from "chai";
import { ethers } from "hardhat";

import { parseEther } from "ethers/lib/utils";
import { utils } from "ethers";

import { Experimental, NetworkConfig } from "../clients/src";
import getNetworkConfig from "../shared/helpers/getNetworkConfig";

describe.only("Signer tests", function () {
  let networkConfig: NetworkConfig;

  describe("ERC20", async function () {
    let mockERC20;
    let tokenSupply;
    let blsSigner: InstanceType<typeof Experimental.BlsSigner>;

    this.beforeAll(async function () {
      const fundedSigners = await ethers.getSigners();

      networkConfig = await getNetworkConfig("local");

      const aggregatorUrl = "http://localhost:3000";
      const verificationGateway = networkConfig.addresses.verificationGateway;
      const rpcUrl = "http://localhost:8545";
      const network = {
        name: "localhost",
        chainId: 0x7a69,
      };

      const privateKey = ethers.Wallet.createRandom().privateKey;
      const blsProvider = new Experimental.BlsProvider(
        aggregatorUrl,
        verificationGateway,
        rpcUrl,
        network,
      );
      blsSigner = blsProvider.getSigner(privateKey);

      const fundedWallet = new ethers.Wallet(
        "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
        new ethers.providers.JsonRpcProvider(rpcUrl),
      );

      const tx = await fundedWallet.sendTransaction({
        to: await blsSigner.getAddress(),
        value: parseEther("10"),
      });
      await tx.wait();

      tokenSupply = utils.parseUnits("1000000");
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      mockERC20 = await MockERC20.deploy("AnyToken", "TOK", tokenSupply);
      await mockERC20.deployed();
      await mockERC20
        .connect(fundedSigners[2])
        .transfer(await blsSigner.getAddress(), tokenSupply);
    });

    it("balanceOf() call", async function () {
      const initialBalance = await mockERC20.balanceOf(
        await blsSigner.getAddress(),
      );
      expect(initialBalance).to.equal(tokenSupply);
    });

    it("calls balanceOf successfully after instantiating Contract class with BlsSigner", async function () {
      const blsSignerAddress = await blsSigner.getAddress();
      const ERC20 = new ethers.Contract(
        mockERC20.address,
        mockERC20.interface,
        blsSigner,
      );
      expect(await ERC20.signer.getAddress()).to.equal(blsSignerAddress);

      const initialBalance = await ERC20.balanceOf(blsSignerAddress);
      expect(initialBalance).to.equal(tokenSupply);
    });

    it.only("transfer() call", async function () {
      const recipient = ethers.Wallet.createRandom().address;
      const blsSignerAddress = await blsSigner.getAddress();

      const initialRecipientBalance = await mockERC20.balanceOf(recipient);
      const initialBlsSignerBalance = await mockERC20.balanceOf(
        blsSignerAddress,
      );
      expect(initialRecipientBalance).to.equal(0);
      expect(initialBlsSignerBalance).to.equal(tokenSupply);

      // transfer
      const tx = await mockERC20
        .connect(blsSigner)
        .transfer(recipient, tokenSupply.div(2));
      await tx.wait();

      // poll for increase in balance
      const retries = 10;
      let pollCount = 0;
      while (pollCount < retries) {
        pollCount++;

        const balance = await mockERC20.balanceOf(recipient);
        if (!balance.eq(initialRecipientBalance)) {
          break;
        }

        console.log(
          `Balance has not increased, waiting 500ms. Attempt ${pollCount}/${retries}`,
        );
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const newReceipientBalance = await mockERC20.balanceOf(recipient);
      expect(newReceipientBalance).to.equal(tokenSupply.div(2));
    });

    //   it("approve() and transferFrom() calls", async function () {
    //     const initialBalance = await mockERC20.balanceOf(
    //       await blsSigners[1].getAddress(),
    //     );

    //     const erc20ToTransfer = parseEther("11.0");

    //     const txApprove = await mockERC20
    //       .connect(blsSigners[0])
    //       .approve(await blsSigners[1].getAddress(), erc20ToTransfer);
    //     txApprove.wait();

    //     const txTransferFrom = await mockERC20
    //       .connect(blsSigners[0])
    //       .transferFrom(
    //         await blsSigners[0].getAddress(),
    //         await blsSigners[1].getAddress(),
    //         erc20ToTransfer,
    //       );
    //     txTransferFrom.wait();

    //     const newBalance = await mockERC20.balanceOf(
    //       await blsSigners[1].getAddress(),
    //     );
    //     expect(newBalance.sub(initialBalance)).to.equal(erc20ToTransfer);
    //   });
    // });

    // describe("ERC721", async function () {
    //   let mockERC721;

    //   this.beforeAll(async function () {
    //     const MockERC721 = await ethers.getContractFactory("MockERC721");
    //     mockERC721 = await MockERC721.deploy("AnyNFT", "NFT");
    //     await mockERC721.deployed();
    //   });

    //   it("safeMint() call", async function () {
    //     const tokenId = 1;
    //     const mint = await mockERC721
    //       .connect(blsSigners[0])
    //       .safeMint(blsSigners[1].address, tokenId);
    //     mint.wait();

    //     expect(await mockERC721.ownerOf(tokenId)).to.equal(blsSigners[1].address);
    //   });

    //   it("balanceOf() call", async function () {
    //     const mint = await mockERC721
    //       .connect(blsSigners[0])
    //       .safeMint(blsSigners[2].address, 2);
    //     mint.wait();

    //     // Check getting address from signer and passing it to a balanceOf call
    //     expect(await mockERC721.balanceOf(blsSigners[2].address)).to.equal(1);
    //   });

    //   it("transfer() call", async function () {
    //     const tokenId = 3;

    //     // Mint a token to signer[3]
    //     const mint = await mockERC721
    //       .connect(blsSigners[0])
    //       .safeMint(blsSigners[3].address, tokenId);
    //     mint.wait();

    //     // Check signer[3] owns the token
    //     expect(await mockERC721.ownerOf(tokenId)).to.equal(blsSigners[3].address);

    //     // Transfer the token from signer 3 to signer 2
    //     await mockERC721
    //       .connect(blsSigners[3])
    //       .transferFrom(blsSigners[3].address, blsSigners[2].address, tokenId);

    //     // Check signer[2] now owns the token
    //     expect(await mockERC721.ownerOf(tokenId)).to.equal(blsSigners[2].address);
    //   });

    //   it("approve() call", async function () {
    //     // Mint a token to signer[4]
    //     const tokenId = 4;
    //     const mint = await mockERC721
    //       .connect(blsSigners[0])
    //       .safeMint(blsSigners[4].address, 4);
    //     mint.wait();

    //     // Approve the token for signer[1] address
    //     await mockERC721
    //       .connect(blsSigners[4])
    //       .approve(blsSigners[1].address, tokenId);

    //     // Check signer[1]'s address is now an approved address for the token
    //     expect(await mockERC721.getApproved(tokenId)).to.equal(
    //       blsSigners[1].address,
    //     );
    // });
  });
});
