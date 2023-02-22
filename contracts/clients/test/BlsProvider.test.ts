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
      chainId: 0x7a69,
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

  it("should return a new signer if one has not been instantiated", async () => {
    // Arrange
    const newBlsProvider = new Experimental.BlsProvider(
      aggregatorUrl,
      verificationGateway,
      aggregatorUtilities,
      rpcUrl,
      network,
    );

    // Act
    const newPrivateKey = await BlsWalletWrapper.getRandomBlsPrivateKey();

    const newBlsSigner = newBlsProvider.getSigner(newPrivateKey);

    // Assert
    expect(newBlsSigner).to.not.equal(blsSigner);
    expect(newBlsSigner).to.equal(newBlsProvider.getSigner(newPrivateKey));
  });

  it("should throw an error when this.signer has not been assigned", async () => {
    // Arrange
    const newBlsProvider = new Experimental.BlsProvider(
      aggregatorUrl,
      verificationGateway,
      aggregatorUtilities,
      rpcUrl,
      network,
    );

    const recipient = ethers.Wallet.createRandom().address;
    const value = parseEther("1");
    const transactionRequest = {
      to: recipient,
      value,
    };

    // Act
    const gasEstimate = async () =>
      await newBlsProvider.estimateGas(transactionRequest);

    // Assert
    await expect(gasEstimate()).to.be.rejectedWith(
      Error,
      "Call provider.getSigner first",
    );
  });

  it("should throw an error estimating gas when 'transaction.to' has not been defined", async () => {
    // Arrange
    const transaction = {
      value: parseEther("1"),
    };

    // Act
    const result = async () => await blsProvider.estimateGas(transaction);

    // Assert
    await expect(result()).to.be.rejectedWith(
      TypeError,
      "Transaction.to should be defined",
    );
  });

  it("should throw an error sending a transaction when this.signer is not defined", async () => {
    // Arrange
    const newBlsProvider = new Experimental.BlsProvider(
      aggregatorUrl,
      verificationGateway,
      aggregatorUtilities,
      rpcUrl,
      network,
    );
    const signedTransaction = blsSigner.signTransaction({
      to: ethers.Wallet.createRandom().address,
      value: parseEther("1"),
    });

    // Act
    const result = async () =>
      await newBlsProvider.sendTransaction(signedTransaction);

    // Assert
    await expect(result()).to.be.rejectedWith(
      Error,
      "Call provider.getSigner first",
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
});
