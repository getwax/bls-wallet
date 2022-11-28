import { ethers as hardhatEthers } from "hardhat";
import { expect } from "chai";
import { ethers, Wallet, BigNumber } from "ethers";
import { parseEther, resolveProperties } from "ethers/lib/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  BlsProvider,
  BlsSigner,
  ActionData,
  BlsWalletWrapper,
  NetworkConfig,
} from "../clients/src";
import getNetworkConfig from "../shared/helpers/getNetworkConfig";

let networkConfig: NetworkConfig;
let signers: SignerWithAddress[];

let aggregatorUrl: string;
let verificationGateway: string;
let rpcUrl: string;
let network: ethers.providers.Networkish;

let privateKey: string;
let blsProvider: BlsProvider;
let blsSigner: BlsSigner;

let regularProvider: ethers.providers.JsonRpcProvider;
let regularSigner: ethers.providers.JsonRpcSigner;

describe("BlsSigner", () => {
  beforeEach(async () => {
    networkConfig = await getNetworkConfig("local");
    signers = await hardhatEthers.getSigners();

    aggregatorUrl = "http://localhost:3000";
    verificationGateway = networkConfig.addresses.verificationGateway;
    rpcUrl = "http://localhost:8545";
    network = {
      name: "localhost",
      chainId: 0x7a69,
    };

    privateKey = Wallet.createRandom().privateKey;

    regularProvider = new ethers.providers.JsonRpcProvider(rpcUrl);

    blsProvider = new BlsProvider(
      aggregatorUrl,
      verificationGateway,
      rpcUrl,
      network,
    );
    blsSigner = blsProvider.getSigner();
    await blsSigner.initWallet(privateKey);

    const fundedWallet = new ethers.Wallet(
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
      regularProvider,
    );

    await fundedWallet.sendTransaction({
      to: blsSigner.wallet.address,
      value: parseEther("1"),
    });
  });

  it("should send ETH (empty call) successfully", async () => {
    // Arrange
    const recipient = signers[1].address;
    const expectedBalance = parseEther("1");
    const recipientBalanceBefore = await blsProvider.getBalance(recipient);

    // Act
    const transaction = await blsSigner.sendTransaction({
      to: recipient,
      value: expectedBalance,
    });
    await transaction.wait();

    // Assert
    expect(
      (await blsProvider.getBalance(recipient)).sub(recipientBalanceBefore),
    ).to.equal(expectedBalance);
  });

  it("should throw an error sending a transaction when 'transaction.to' has not been defined", async () => {
    // Arrange
    const transaction = {
      value: parseEther("1"),
    };

    // Act
    const result = async () => await blsSigner.sendTransaction(transaction);

    // Assert
    await expect(result()).to.be.rejectedWith(
      TypeError,
      "Transaction.to should be defined.",
    );
  });

  it("should return failures as a json string and throw an error when sending an invalid transaction", async () => {
    // Arrange
    const invalidValue = parseEther("-1");

    // Act
    const result = async () =>
      await blsSigner.sendTransaction({
        to: signers[1].address,
        value: invalidValue,
      });

    // Assert
    await expect(result()).to.be.rejectedWith(
      Error,
      '[{"type":"invalid-format","description":"field operations: element 0: field actions: element 0: field ethValue: hex string: missing 0x prefix"},{"type":"invalid-format","description":"field operations: element 0: field actions: element 0: field ethValue: hex string: incorrect byte length: 8.5"}]',
    );
  });

  it("should return a transaction response when sending a transaction", async () => {
    // Arrange
    const recipient = signers[1].address;
    const transactionAmount = parseEther("1");
    const expectedNonce = await BlsWalletWrapper.Nonce(
      blsSigner.wallet.PublicKey(),
      blsSigner.verificationGatewayAddress,
      blsProvider,
    );
    const expectedChainId = await blsSigner.getChainId();

    // Act
    const transactionResponse = await blsSigner.sendTransaction({
      to: recipient,
      value: transactionAmount,
    });

    // Assert
    expect(transactionResponse).to.be.an("object");
    expect(transactionResponse).to.have.property("hash");
    expect(transactionResponse).to.have.property("confirmations").to.equal(1);
    expect(transactionResponse)
      .to.have.property("from")
      .to.equal(blsSigner.wallet.address);
    expect(transactionResponse)
      .to.have.property("nonce")
      .to.equal(expectedNonce);
    expect(transactionResponse)
      .to.have.property("gasLimit")
      .to.equal(BigNumber.from("0x0"));
    expect(transactionResponse)
      .to.have.property("value")
      .to.equal(BigNumber.from(transactionAmount));
    expect(transactionResponse).to.have.property("data");
    expect(transactionResponse)
      .to.have.property("chainId")
      .to.equal(expectedChainId);
    expect(transactionResponse).to.have.property("wait");
  });

  it("should throw an error when a signer has not been initialized", async () => {
    // Arrange
    const newBlsProvider = new BlsProvider(
      aggregatorUrl,
      verificationGateway,
      rpcUrl,
      network,
    );
    const uninitializedBlsSigner = newBlsProvider.getSigner();

    // Act
    const result = async () =>
      await uninitializedBlsSigner.sendTransaction({
        to: signers[1].address,
        value: parseEther("1"),
      });

    // Assert
    await expect(result()).to.be.rejectedWith(
      Error,
      "To perform this operation, ensure you have instantiated a BlsSigner and have called this.init() to initialize the wallet.",
    );
  });

  it("should retrieve the account address", async () => {
    // Arrange
    const expectedAddress = await BlsWalletWrapper.Address(
      privateKey,
      verificationGateway,
      blsProvider,
    );

    // Act
    const address = await blsSigner.getAddress();

    // Assert
    expect(address).to.equal(expectedAddress);
  });

  it("should sign a transaction to create a bundle", async () => {
    // Arrange
    const recipient = signers[1].address;
    const action: ActionData = {
      ethValue: "1",
      contractAddress: recipient,
      encodedFunction: "0x",
    };

    // get expected signature
    const wallet = await BlsWalletWrapper.connect(
      privateKey,
      verificationGateway,
      blsProvider,
    );
    const walletAddress = wallet.address;

    const nonce = await BlsWalletWrapper.Nonce(
      wallet.PublicKey(),
      verificationGateway,
      blsSigner,
    );
    const operation = {
      nonce,
      actions: [action],
    };

    const expectedBundle = wallet.blsWalletSigner.sign(
      operation,
      privateKey,
      walletAddress,
    );

    // Act
    const bundle = await blsSigner.signBlsTransaction(action);

    // Assert
    expect(bundle.signature).to.deep.equal(expectedBundle.signature);
  });

  it("should throw an error when signTransaction() is called", async () => {
    // Arrange & Act
    const result = async () =>
      await blsSigner.signTransaction({
        to: signers[1].address,
        value: parseEther("1"),
      });

    // Assert
    await expect(result()).to.be.rejectedWith(
      Error,
      "signTransaction() is not implemented, call 'signBlsTransaction()' instead.",
    );
  });

  it("should check transaction", async () => {
    // Arrange
    const recipient = signers[1].address;
    const transactionAmount = parseEther("1");
    const transaction = {
      to: recipient,
      value: transactionAmount,
    };

    // Act
    const result = blsSigner.checkTransaction(transaction);

    // Assert
    expect(result.to).to.equal(recipient);
    expect(result.value).to.equal(transactionAmount);

    const resolvedResult = await resolveProperties(result);
    expect(resolvedResult.from).to.equal(await blsSigner.getAddress());
  });

  it("should populate transaction", async () => {
    // Arrange
    const recipient = signers[1].address;
    const transactionAmount = parseEther("1");
    const transaction = {
      to: recipient,
      value: transactionAmount,
    };

    // Act
    const result = await blsSigner.populateTransaction(transaction);

    // Assert
    expect(result.to).to.equal(recipient);
    expect(result.value).to.equal(transactionAmount);
    expect(result.from).to.equal(await blsSigner.getAddress());
    expect(result.type).to.equal(2);
    expect(result).to.have.property("maxFeePerGas");
    expect(result).to.have.property("maxPriorityFeePerGas");
    expect(result).to.have.property("nonce");
    expect(result).to.have.property("gasLimit");
    expect(result.chainId).to.equal(31337);
  });

  it("should throw an error when signMessage is called", async () => {
    // Arrange
    const message = "Hello World";

    // Act
    const signMessage = async () => await blsSigner.signMessage(message);

    // Assert
    expect(signMessage()).to.be.rejectedWith(
      Error,
      "signMessage() is not implemented.",
    );
  });

  it("should sign message using signBlsMessage", () => {
    // Arrange
    const address = signers[1].address;
    const expectedSignature = blsSigner.wallet.blsWalletSigner.signMessage(
      address,
      blsSigner.wallet.privateKey,
    );

    // Act
    const signedMessage = blsSigner.signBlsMessage(address);

    // Assert
    expect(signedMessage).to.deep.equal(expectedSignature);
  });
});

describe("JsonRpcSigner", () => {
  beforeEach(async () => {
    signers = await hardhatEthers.getSigners();
    rpcUrl = "http://localhost:8545";
    regularProvider = new ethers.providers.JsonRpcProvider(rpcUrl);
    regularSigner = regularProvider.getSigner();
  });

  it("should retrieve the account address", async () => {
    // Arrange
    const expectedAddress = signers[0].address;

    // Act
    const address = await regularSigner.getAddress();

    // Assert
    expect(address).to.equal(expectedAddress);
  });

  it("should send ETH (empty call) successfully", async () => {
    // Arrange
    const recipient = signers[1].address;
    const expectedBalance = parseEther("1");
    const recipientBalanceBefore = await regularProvider.getBalance(recipient);

    // Act
    const transaction = await regularSigner.sendTransaction({
      to: recipient,
      value: expectedBalance,
    });
    await transaction.wait();

    // Assert
    expect(
      (await regularProvider.getBalance(recipient)).sub(recipientBalanceBefore),
    ).to.equal(expectedBalance);
  });

  it("should check transaction", async () => {
    // Arrange
    const recipient = signers[1].address;
    const transactionAmount = parseEther("1");
    const transaction = {
      to: recipient,
      value: transactionAmount,
    };

    // Act
    const result = regularSigner.checkTransaction(transaction);

    // Assert
    expect(result.to).to.equal(recipient);
    expect(result.value).to.equal(transactionAmount);

    const resolvedResult = await resolveProperties(result);
    expect(resolvedResult.from).to.equal(await regularSigner.getAddress());
  });

  it("should populate transaction", async () => {
    // Arrange
    const recipient = signers[1].address;
    const transactionAmount = parseEther("1");
    const transaction = {
      to: recipient,
      value: transactionAmount,
    };

    // Act
    const result = await regularSigner.populateTransaction(transaction);

    // Assert
    expect(result.to).to.equal(recipient);
    expect(result.value).to.equal(transactionAmount);
    expect(result.from).to.equal(signers[0].address);
    expect(result.type).to.equal(2);
    expect(result).to.have.property("maxFeePerGas");
    expect(result).to.have.property("maxPriorityFeePerGas");
    expect(result).to.have.property("nonce");
    expect(result).to.have.property("gasLimit");
    expect(result.chainId).to.equal(31337);
  });
});
