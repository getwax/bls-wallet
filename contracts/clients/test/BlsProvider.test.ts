import { expect } from "chai";
import { BigNumber, ethers } from "ethers";
import { parseEther } from "ethers/lib/utils";

import { BlsProvider, BlsSigner, bundleToDto } from "../src";
import { UncheckedBlsSigner } from "../src/BlsSigner";
import { initBlsWalletSigner } from "../src/signer";

let aggregatorUrl: string;
let verificationGateway: string;
let aggregatorUtilities: string;
let rpcUrl: string;
let network: ethers.providers.Networkish;

let privateKey: string;
let blsProvider: BlsProvider;
let blsSigner: BlsSigner;

let regularProvider: ethers.providers.JsonRpcProvider;

describe("BlsProvider", () => {
  beforeEach(async () => {
    aggregatorUrl = "http://localhost:3000";
    verificationGateway = "0xC8CD2BE653759aed7B0996315821AAe71e1FEAdF";
    aggregatorUtilities = "0xC8CD2BE653759aed7B0996315821AAe71e1FEAdF";
    rpcUrl = "http://localhost:8545";
    network = {
      name: "localhost",
      chainId: 0x539, // 1337
    };

    privateKey = await BlsSigner.getRandomBlsPrivateKey();

    blsProvider = new BlsProvider(
      aggregatorUrl,
      verificationGateway,
      aggregatorUtilities,
      rpcUrl,
      network,
    );
    blsSigner = blsProvider.getSigner(privateKey);

    regularProvider = new ethers.providers.JsonRpcProvider(rpcUrl);
  });

  it("should return a valid signer", () => {
    // Arrange & Act
    const blsSigner = blsProvider.getSigner(privateKey);

    // Assert
    expect(blsSigner._isSigner).to.be.true;
    expect(blsSigner).to.be.instanceOf(BlsSigner);
  });

  it("should return a valid unchecked bls signer", () => {
    // Arrange & Act
    const uncheckedBlsSigner = blsProvider.getUncheckedSigner(privateKey);

    // Assert
    expect(uncheckedBlsSigner._isSigner).to.be.true;
    expect(uncheckedBlsSigner).to.be.instanceOf(UncheckedBlsSigner);
  });

  it("should return a new signer", async () => {
    // Arrange
    const newVerificationGateway = "newMockVerificationGatewayAddress";
    const newBlsProvider = new BlsProvider(
      aggregatorUrl,
      newVerificationGateway,
      aggregatorUtilities,
      rpcUrl,
      network,
    );

    // Act
    const newPrivateKey = await BlsSigner.getRandomBlsPrivateKey();

    const newBlsSigner = newBlsProvider.getSigner(newPrivateKey);

    // Assert
    expect(newBlsSigner).to.not.equal(blsSigner);
    expect(newBlsSigner.provider.verificationGatewayAddress).to.not.equal(
      verificationGateway,
    );
    expect(newBlsSigner.provider.verificationGatewayAddress).to.equal(
      newVerificationGateway,
    );
  });

  it("should throw an error estimating gas when 'transaction.to' has not been defined", async () => {
    // Arrange
    const transaction = {
      value: parseEther("1"),
      // Explicitly omit 'to'
    };

    // Act
    const result = async () => await blsProvider.estimateGas(transaction);

    // Assert
    await expect(result()).to.be.rejectedWith(
      TypeError,
      "Transaction.to should be defined",
    );
  });

  it("should throw an error estimating gas when 'transaction.from' has not been defined", async () => {
    // Arrange
    const transaction = {
      value: parseEther("1"),
      to: ethers.Wallet.createRandom().address,
      // Explicitly omit 'from'
    };

    // Act
    const result = async () => await blsProvider.estimateGas(transaction);

    // Assert
    await expect(result()).to.be.rejectedWith(
      TypeError,
      "Transaction.from should be defined",
    );
  });

  it("should return the connection info for the provider", () => {
    // Arrange
    const expectedConnection = regularProvider.connection;

    // Act
    const connection = blsProvider.connection;

    // Assert
    expect(connection).to.deep.equal(expectedConnection);
  });

  it("should throw an error when sending invalid signed transactions", async () => {
    // Arrange
    const invalidTransaction = "Invalid signed transaction";

    // Act
    const result = async () =>
      await blsProvider.sendTransaction(invalidTransaction);
    const batchResult = async () =>
      await blsProvider.sendTransaction(invalidTransaction);

    // Assert
    await expect(result()).to.be.rejectedWith(
      Error,
      "Unexpected token I in JSON at position 0",
    );
    await expect(batchResult()).to.be.rejectedWith(
      Error,
      "Unexpected token I in JSON at position 0",
    );
  });

  it("should get the polling interval", async () => {
    // Arrange
    const expectedpollingInterval = 4000; // default
    const updatedInterval = 1000;

    // Act
    const pollingInterval = blsProvider.pollingInterval;
    blsProvider.pollingInterval = updatedInterval;
    const updatedPollingInterval = blsProvider.pollingInterval;

    // Assert
    expect(pollingInterval).to.equal(expectedpollingInterval);
    expect(updatedPollingInterval).to.equal(updatedInterval);
  });

  it("should get the event listener count and remove all listeners", async () => {
    blsProvider.on("block", () => {});
    blsProvider.on("error", () => {});
    expect(blsProvider.listenerCount("block")).to.equal(1);
    expect(blsProvider.listenerCount("error")).to.equal(1);
    expect(blsProvider.listenerCount()).to.equal(2);

    blsProvider.removeAllListeners();
    expect(blsProvider.listenerCount("block")).to.equal(0);
    expect(blsProvider.listenerCount("error")).to.equal(0);
    expect(blsProvider.listenerCount()).to.equal(0);
  });

  it("should return true and an array of listeners if polling", async () => {
    // Arrange
    const expectedListener = () => {};

    // Act
    blsProvider.on("block", expectedListener);
    const listeners = blsProvider.listeners("block");
    const isPolling = blsProvider.polling;
    blsProvider.removeAllListeners();

    // Assert
    expect(listeners).to.deep.equal([expectedListener]);
    expect(isPolling).to.be.true;
  });

  it("should be a provider", async () => {
    // Arrange & Act
    const isProvider = BlsProvider.isProvider(blsProvider);
    const isProviderWithInvalidProvider = BlsProvider.isProvider(blsSigner);

    // Assert
    expect(isProvider).to.equal(true);
    expect(isProviderWithInvalidProvider).to.equal(false);
  });

  it("should a return a promise which will stall until the network has heen established", async () => {
    // Arrange
    const expectedReady = { name: "localhost", chainId: 1337 };

    // Act
    const ready = await blsProvider.ready;

    // Assert
    expect(ready).to.deep.equal(expectedReady);
  });

  it("should throw an error when sending multiple signed operations to sendTransaction", async () => {
    // Arrange
    const mockWalletAddress = "0x1337AF0f4b693fd1c36d7059a0798Ff05a60DFFE";
    const { sign, aggregate } = await initBlsWalletSigner({
      chainId: 123,
      verificationGatewayAddress: verificationGateway,
      privateKey,
    });

    const expectedAmount = parseEther("1");
    const verySafeFee = parseEther("0.1");
    const firstRecipient = ethers.Wallet.createRandom().address;
    const secondRecipient = ethers.Wallet.createRandom().address;

    const firstActionWithSafeFee = blsProvider._addFeePaymentActionWithSafeFee(
      [
        {
          ethValue: expectedAmount,
          contractAddress: firstRecipient,
          encodedFunction: "0x",
        },
      ],
      verySafeFee,
    );
    const secondActionWithSafeFee = blsProvider._addFeePaymentActionWithSafeFee(
      [
        {
          ethValue: expectedAmount,
          contractAddress: secondRecipient,
          encodedFunction: "0x",
        },
      ],
      verySafeFee,
    );

    const nonce = BigNumber.from(0);

    const firstOperation = {
      nonce,
      gas: BigNumber.from(30_000_000),
      actions: [...firstActionWithSafeFee],
    };
    const secondOperation = {
      nonce,
      gas: BigNumber.from(30_000_000),
      actions: [...secondActionWithSafeFee],
    };

    const firstBundle = sign(firstOperation, mockWalletAddress);
    const secondBundle = sign(secondOperation, mockWalletAddress);

    const aggregatedBundle = aggregate([firstBundle, secondBundle]);

    // Act
    const result = async () =>
      await blsProvider.sendTransaction(
        JSON.stringify(bundleToDto(aggregatedBundle)),
      );

    // Assert
    await expect(result()).to.rejectedWith(
      Error,
      "Can only operate on single operations. Call provider.sendTransactionBatch instead",
    );
  });
});
