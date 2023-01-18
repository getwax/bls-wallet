import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, utils, Wallet } from "ethers";

import { Experimental } from "../clients/src";
import getNetworkConfig from "../shared/helpers/getNetworkConfig";

describe("Provider tests", function () {
  let blsProvider;
  let fundedWallet: Wallet;

  this.beforeAll(async function () {
    const networkConfig = await getNetworkConfig("local");

    const aggregatorUrl = "http://localhost:3000";
    const verificationGateway = networkConfig.addresses.verificationGateway;
    const rpcUrl = "http://localhost:8545";
    const network = {
      name: "localhost",
      chainId: 0x7a69,
    };
    blsProvider = new Experimental.BlsProvider(
      aggregatorUrl,
      verificationGateway,
      rpcUrl,
      network,
    );
  });

  describe("ERC20", async function () {
    let mockERC20;
    let tokenSupply: BigNumber;
    let recipient;

    this.beforeAll(async function () {
      fundedWallet = new ethers.Wallet(
        "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // HH Account #4
        new ethers.providers.JsonRpcProvider("http://localhost:8545"),
      );
      recipient = ethers.Wallet.createRandom().address;
      tokenSupply = utils.parseUnits("1000000");
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      mockERC20 = await MockERC20.connect(fundedWallet).deploy(
        "AnyToken",
        "TOK",
        tokenSupply,
      );
      await mockERC20.deployed();

      await mockERC20.transfer(recipient, tokenSupply);
    });

    it("balanceOf() call", async function () {
      const balance = await mockERC20.connect(blsProvider).balanceOf(recipient);
      expect(balance).to.equal(tokenSupply);
    });

    it("calls balanceOf successfully after instantiating Contract class with BlsProvider", async function () {
      const erc20 = new ethers.Contract(
        mockERC20.address,
        mockERC20.interface,
        blsProvider,
      );
      const balance = await erc20.balanceOf(recipient);

      expect(erc20.provider).to.equal(blsProvider);
      expect(balance).to.equal(tokenSupply);
    });
  });
});
