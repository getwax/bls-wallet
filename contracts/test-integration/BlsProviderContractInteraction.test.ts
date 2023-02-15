import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, utils, Wallet } from "ethers";

import { Experimental, BlsWalletWrapper } from "../clients/src";
import getNetworkConfig from "../shared/helpers/getNetworkConfig";

describe("Provider tests", function () {
  let blsProvider;
  let blsSigner;
  let fundedWallet: Wallet;

  this.beforeAll(async () => {
    const networkConfig = await getNetworkConfig("local");
    const privateKey = await BlsWalletWrapper.getRandomBlsPrivateKey();
    const aggregatorUrl = "http://localhost:3000";
    const verificationGateway = networkConfig.addresses.verificationGateway;
    const aggregatorUtilities = networkConfig.addresses.utilities;
    const rpcUrl = "http://localhost:8545";
    const network = {
      name: "localhost",
      chainId: 0x539, // 1337
    };
    blsProvider = new Experimental.BlsProvider(
      aggregatorUrl,
      verificationGateway,
      aggregatorUtilities,
      rpcUrl,
      network,
    );
    blsSigner = blsProvider.getSigner(privateKey);
  });

  describe("ERC20", async function () {
    let mockERC20;
    let tokenSupply: BigNumber;
    let recipient;

    this.beforeAll(async () => {
      fundedWallet = new ethers.Wallet(
        "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // Hardhat Account #2 private key
        new ethers.providers.JsonRpcProvider("http://localhost:8545"),
      );

      const tx = await fundedWallet.sendTransaction({
        to: await blsSigner.getAddress(),
        value: utils.parseEther("100"),
      });
      await tx.wait();

      recipient = ethers.Wallet.createRandom().address;
      tokenSupply = utils.parseUnits("1000000");
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      mockERC20 = await MockERC20.connect(fundedWallet).deploy(
        "AnyToken",
        "TOK",
        tokenSupply,
      );
      await mockERC20.deployed();

      await mockERC20.transfer(recipient, tokenSupply.div(2));
      await mockERC20.transfer(
        await blsSigner.getAddress(),
        tokenSupply.div(2),
      );
    });

    it("balanceOf() call", async () => {
      const balance = await mockERC20.connect(blsProvider).balanceOf(recipient);
      expect(balance).to.equal(tokenSupply.div(2));
    });

    it("calls balanceOf successfully after instantiating Contract class with BlsProvider", async () => {
      const erc20 = new ethers.Contract(
        mockERC20.address,
        mockERC20.interface,
        blsProvider,
      );
      const balance = await erc20.balanceOf(recipient);

      expect(erc20.provider).to.equal(blsProvider);
      expect(balance).to.equal(tokenSupply.div(2));
    });

    it("should add event listener that is triggered by a custom filter", async () => {
      // Arrange
      blsProvider.removeAllListeners();
      const erc20 = new ethers.Contract(
        mockERC20.address,
        mockERC20.interface,
        blsProvider,
      );

      let value = "";
      const setValue = async () => {
        value = "Value set on event";
      };

      const amountToTransfer = ethers.utils.parseUnits("1");
      const balanceBefore = await erc20.balanceOf(recipient);
      const filter = {
        address: mockERC20.address,
        topics: [utils.id("Transfer(address,address,uint256)")],
      };

      // Act
      const listenerCountBeforeEventListener =
        blsProvider.listenerCount(filter);
      blsProvider.on(filter, setValue); // set value when event occurs

      const tx = await erc20
        .connect(blsSigner)
        .transfer(recipient, amountToTransfer);
      await tx.wait();

      const listenerCountDuringEventListener =
        blsProvider.listenerCount(filter);

      blsProvider.off(filter);

      // Assert
      expect((await erc20.balanceOf(recipient)).sub(balanceBefore)).to.equal(
        amountToTransfer,
      );
      expect(listenerCountBeforeEventListener).to.equal(0);
      expect(listenerCountDuringEventListener).to.equal(1);
      expect(blsProvider.listenerCount(filter)).to.equal(0);
      expect(value).to.equal("Value set on event");
    });

    it("should add event listener that is triggered by a custom filter and is removed automatically", async () => {
      // Arrange
      blsProvider.removeAllListeners();
      const erc20 = new ethers.Contract(
        mockERC20.address,
        mockERC20.interface,
        blsProvider,
      );

      let value = "";
      const setValue = async () => {
        value = "Value set on event";
      };

      const amountToTransfer = ethers.utils.parseUnits("1");
      const balanceBefore = await erc20.balanceOf(recipient);
      const filter = {
        address: mockERC20.address,
        topics: [utils.id("Transfer(address,address,uint256)")],
      };

      // Act
      const listenerCountBeforeEventListener =
        blsProvider.listenerCount(filter);
      blsProvider.once(filter, setValue); // set value when event occurs
      const listenerCountDuringEventListener =
        blsProvider.listenerCount(filter);

      const tx = await erc20
        .connect(blsSigner)
        .transfer(recipient, amountToTransfer);
      await tx.wait();

      // Assert
      expect((await erc20.balanceOf(recipient)).sub(balanceBefore)).to.equal(
        amountToTransfer,
      );
      expect(listenerCountBeforeEventListener).to.equal(0);
      expect(listenerCountDuringEventListener).to.equal(1);
      expect(blsProvider.listenerCount(filter)).to.equal(0);
      expect(value).to.equal("Value set on event");
    });

    it("should return the logs for matching filters", async () => {
      // Arrange
      const amountToTransfer = ethers.utils.parseUnits("1");
      const balanceBefore = await mockERC20.balanceOf(recipient);
      const tx = await mockERC20
        .connect(blsSigner)
        .transfer(recipient, amountToTransfer);
      const receipt = await tx.wait();

      const transferAbi = [
        "event Transfer(address indexed from, address indexed to, uint256 value)",
      ];
      const erc20Interface = new ethers.utils.Interface(transferAbi);

      const expectedLogs = await blsProvider.getLogs({
        fromBlock: "earliest",
        toBlock: "latest",
        address: mockERC20.address,
        topics: [ethers.utils.id("Transfer(address,address,uint256)")],
      });

      // Act
      const logs = await blsProvider.getLogs({
        fromBlock: "earliest",
        toBlock: "latest",
        address: mockERC20.address,
        topics: [ethers.utils.id("Transfer(address,address,uint256)")],
      });

      // Assert
      const transferLog = logs.find(
        (log) => log.transactionHash === receipt.transactionHash,
      );
      const transferEvent = erc20Interface.parseLog(transferLog);

      expect(
        (await mockERC20.balanceOf(recipient)).sub(balanceBefore),
      ).to.equal(amountToTransfer);
      expect(logs).to.deep.equal(expectedLogs);
      expect(transferEvent.args.value).to.equal(amountToTransfer);
      expect(transferEvent.args.from).to.equal(await blsSigner.getAddress());
      expect(transferEvent.args.to).to.equal(recipient);
    });

    it("should get code located at address and block number", async function () {
      // Arrange
      const provider = new ethers.providers.JsonRpcProvider();
      const expectedCode = await provider.getCode(mockERC20.address);

      // Act
      const code = await blsProvider.getCode(mockERC20.address);

      // Assert
      expect(code).to.equal(expectedCode);
    });

    it("should return '0x' if no code located at address", async function () {
      // Arrange
      const fakeAddress = ethers.Wallet.createRandom().address;
      const expectedCode = "0x";

      // Act
      const invalidAddress = await blsProvider.getCode(fakeAddress);
      const realAddressBeforeDeployment = await blsProvider.getCode(
        mockERC20.address,
        "earliest",
      );

      // Assert
      expect(invalidAddress).to.equal(expectedCode);
      expect(realAddressBeforeDeployment).to.equal(expectedCode);
    });

    it("should return the Bytes32 value of the storage slot position at erc20 address", async function () {
      // Arrange
      const provider = new ethers.providers.JsonRpcProvider();
      const expectedStorage1 = await provider.getStorageAt(
        mockERC20.address,
        1,
      );
      const expectedStorage2 = await provider.getStorageAt(
        mockERC20.address,
        2,
      );

      // Act
      const storage1 = await blsProvider.getStorageAt(mockERC20.address, 1);
      const storage2 = await blsProvider.getStorageAt(mockERC20.address, 2);

      // Assert
      expect(storage1).to.equal(expectedStorage1); // 0x0000000000000000000000000000000000000000000000000000000000000000
      expect(storage2).to.equal(expectedStorage2); // 0x00000000000000000000000000000000000000000000d3c21bcecceda1000000
    });
  });
});
