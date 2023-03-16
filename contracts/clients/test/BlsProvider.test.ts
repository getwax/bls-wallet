import { expect } from "chai";
import { ethers } from "ethers";
import { parseEther } from "ethers/lib/utils";

import { Experimental, BlsWalletWrapper } from "../src";
import BlsSigner, { UncheckedBlsSigner } from "../src/BlsSigner";

let aggregatorUrl: string;
let verificationGateway: string;
let aggregatorUtilities: string;
let rpcUrl: string;
let network: ethers.providers.Networkish;

let privateKey: string;
let blsProvider: InstanceType<typeof Experimental.BlsProvider>;
let blsSigner: InstanceType<typeof Experimental.BlsSigner>;

let regularProvider: ethers.providers.JsonRpcProvider;

describe("BlsProvider", () => {
  beforeEach(async () => {
    aggregatorUrl = "http://localhost:3000";
    verificationGateway = "mockVerificationGatewayAddress";
    aggregatorUtilities = "mockAggregatorUtilitiesAddress";
    rpcUrl = "http://localhost:8545";
    network = {
      name: "localhost",
      chainId: 0x539, // 1337
    };

    privateKey = await BlsWalletWrapper.getRandomBlsPrivateKey();

    blsProvider = new Experimental.BlsProvider(
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
    const newBlsProvider = new Experimental.BlsProvider(
      aggregatorUrl,
      newVerificationGateway,
      aggregatorUtilities,
      rpcUrl,
      network,
    );

    // Act
    const newPrivateKey = await BlsWalletWrapper.getRandomBlsPrivateKey();

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
    const isProvider = Experimental.BlsProvider.isProvider(blsProvider);
    const isProviderWithInvalidProvider =
      Experimental.BlsProvider.isProvider(blsSigner);

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
});
