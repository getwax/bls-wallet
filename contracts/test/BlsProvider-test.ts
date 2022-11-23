import { ethers } from "hardhat";
import chai, { expect } from "chai";
import spies from "chai-spies";
import { Wallet } from "@ethersproject/wallet";
import { JsonRpcProvider, JsonRpcSigner } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Networkish } from "@ethersproject/networks";
import { parseEther } from "ethers/lib/utils";

import { BlsProvider, BlsSigner, BlsWalletWrapper } from "../clients/src";

chai.use(spies);

let signers: SignerWithAddress[];

let aggregatorUrl: string;
let verificationGateway: string;
let rpcUrl: string;
let network: Networkish;

let privateKey: string;
let blsProvider: BlsProvider;
let blsSigner: BlsSigner;

let regularProvider: JsonRpcProvider;
let regularSigner: JsonRpcSigner;

describe.only("BlsProvider", () => {
  beforeEach(async () => {
    signers = await ethers.getSigners();
    aggregatorUrl = "http://localhost:3000";
    verificationGateway = "0x689A095B4507Bfa302eef8551F90fB322B3451c6";
    rpcUrl = "http://localhost:8545";
    network = {
      name: "localhost",
      chainId: 0x7a69,
    };
    // FIXME: Unsure on best way to manage the private key! Leave it up to dapps/wallets?
    privateKey = Wallet.createRandom().privateKey;

    regularProvider = new JsonRpcProvider(rpcUrl);
    regularSigner = regularProvider.getSigner();

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
      to: await blsSigner.getAddress(),
      value: parseEther("1"),
    });
  });

  it("should return a valid signer", async () => {
    // Arrange & Act
    const blsSigner = blsProvider.getSigner();

    // Assert
    expect(blsSigner._isSigner).to.true;
  });

  it("should return a new signer if one has not been instantiated", async () => {
    // Arrange
    const newBlsProvider = new BlsProvider(
      aggregatorUrl,
      verificationGateway,
      rpcUrl,
      network,
    );

    // Act
    const newBlsSigner = newBlsProvider.getSigner();
    await newBlsSigner.initWallet(privateKey);

    // Assert
    expect(newBlsSigner).to.not.equal(blsSigner);
    expect(newBlsSigner).to.equal(newBlsProvider.getSigner());
  });

  it("should estimate gas without throwing an error", async () => {
    // Arrange
    const recipient = signers[1].address;
    const transactionAmount = parseEther("1");
    const transactionRequest = {
      to: recipient,
      value: transactionAmount,
    };

    // Act
    const gasEstimate = async () =>
      await blsProvider.estimateGas(transactionRequest);

    // Assert
    await expect(gasEstimate()).to.not.be.rejected;
  });

  it("should catch and throw an updated error when an exception occurs estimating gas", async () => {
    // Arrange
    const recipient = signers[1].address;
    const transactionAmount = parseEther("-1");
    const transactionRequest = {
      to: recipient,
      value: transactionAmount,
    };

    // Act
    const gasEstimate = async () =>
      await blsProvider.estimateGas(transactionRequest);

    // Assert
    await expect(gasEstimate()).to.be.rejectedWith(
      Error,
      'estimateGas() - an unexpected error occured: Error: value must be a string (argument="value", value=undefined, code=INVALID_ARGUMENT, version=units/5.5.0)',
    );
  });

  it("should send ETH (empty call) given a valid bundle successfully", async () => {
    // Arrange
    const recipient = signers[1].address;
    const expectedBalance = parseEther("1");
    const balanceBefore = await blsProvider.getBalance(recipient);

    const unsignedTransaction = {
      ethValue: expectedBalance.toString(),
      contractAddress: recipient,
      encodedFunction: "0x",
    };

    const signedTransaction = await blsSigner.signBlsTransaction(
      unsignedTransaction,
    );

    // Act
    const transaction = await blsProvider.sendBlsTransaction(
      signedTransaction,
      blsSigner,
    );
    await transaction.wait();

    // Assert
    expect(
      (await blsProvider.getBalance(recipient)).sub(balanceBefore),
    ).to.equal(expectedBalance);
  });

  it("should get the account nonce when the signer constructs the transaction response", async () => {
    // Arrange
    const spy = chai.spy.on(BlsWalletWrapper, "Nonce");
    const recipient = signers[1].address;
    const expectedBalance = parseEther("1");

    const unsignedTransaction = {
      ethValue: expectedBalance.toString(),
      contractAddress: recipient,
      encodedFunction: "0x",
    };
    const signedTransaction = await blsSigner.signBlsTransaction(
      unsignedTransaction,
    );

    // Act
    await blsProvider.sendBlsTransaction(
      signedTransaction,
      blsSigner,
    );

    // Assert
    // Once when calling "signer.signTransaction", and once when calling "signer.constructTransactionResponse". This unit test is concerned with the latter being called.
    expect(spy).to.have.been.called.twice;
  });

  it("should join failures and throw an error when sending an invalid transaction", async () => {
    // Arrange
    const invalidEthValue = parseEther("-1");

    const unsignedTransaction = {
      ethValue: invalidEthValue,
      contractAddress: signers[1].address,
      encodedFunction: "0x",
    };
    const signedTransaction = await blsSigner.signBlsTransaction(
      unsignedTransaction,
    );

    // Act
    const result = async () =>
      await blsProvider.sendBlsTransaction(signedTransaction, blsSigner);

    // Assert
    await expect(result()).to.be.rejectedWith(
      Error,
      "field operations: element 0: field actions: element 0: field ethValue: hex string: missing 0x prefix\\nfield operations: element 0: field actions: element 0: field ethValue: hex string: incorrect byte length: 8.5",
    );
  });

  it("should retrieve a transaction receipt given a valid hash", async () => {
    // Arrange
    const recipient = signers[1].address;
    const transactionResponse = await blsSigner.sendTransaction({
      to: recipient,
      value: parseEther("1"),
    });

    // Act
    const transactionReceipt = await blsProvider.getTransactionReceipt(
      transactionResponse.hash,
    );

    // Assert
    // TODO: How do we test the assertions commented out as the bundle receipt is received as part of the _getTransactionReceipt() method?
    expect(transactionReceipt).to.be.an("object");
    expect(transactionReceipt).to.have.property("to").to.equal("0x");
    expect(transactionReceipt).to.have.property("from").to.equal("0x");
    expect(transactionReceipt)
      .to.have.property("contractAddress")
      .to.equal("0x");
    expect(transactionReceipt).to.have.property("transactionIndex"); //.to.equal("0x");
    expect(transactionReceipt)
      .to.have.property("gasUsed")
      .to.equal(parseEther("0"));
    expect(transactionReceipt).to.have.property("logsBloom").to.equal("");
    expect(transactionReceipt).to.have.property("blockHash"); //.to.equal("0x");
    expect(transactionReceipt).to.have.property("transactionHash"); //.to.equal("0x");
    expect(transactionReceipt).to.have.property("logs").to.deep.equal([]);
    expect(transactionReceipt).to.have.property("blockNumber"); //.to.equal("0x");
    expect(transactionReceipt)
      .to.have.property("confirmations")
      .to.equal(transactionResponse.confirmations);
    expect(transactionReceipt)
      .to.have.property("cumulativeGasUsed")
      .to.equal(parseEther("0"));
    expect(transactionReceipt)
      .to.have.property("effectiveGasPrice")
      .to.equal(parseEther("0"));
    expect(transactionReceipt).to.have.property("byzantium").to.equal(false);
    expect(transactionReceipt).to.have.property("type").to.equal(2);
  });

  it("should throw an error when the transaction receipt cannot be found", async () => {
    // Arrange
    const invalidTransactionHash = ethers.utils.id("invalid hash");
    const retries = 1; // Setting this to 1 as we do not to wait in order for the logic to be correctly tested

    // Act
    const result = async () =>
      await blsProvider._getTransactionReceipt(
        invalidTransactionHash,
        1,
        retries,
      );

    // Assert
    await expect(result()).to.be.rejectedWith(
      Error,
      `Could not find bundle receipt for transaction hash: ${invalidTransactionHash}`,
    );
  });

  it("should wait for a transaction and resolve once transaction hash is included in the block", async () => {
    // Arrange
    const recipient = signers[1].address;
    const transactionResponse = await blsSigner.sendTransaction({
      to: recipient,
      value: parseEther("1"),
    });

    // Act
    const transactionReceipt = await blsProvider.waitForTransaction(
      transactionResponse.hash,
      1,
      10,
    );

    // Assert
    // TODO: How do we test the assertions commented out as the bundle receipt is received as part of the _getTransactionReceipt() method?
    expect(transactionReceipt).to.be.an("object");
    expect(transactionReceipt).to.have.property("to").to.equal("0x");
    expect(transactionReceipt).to.have.property("from").to.equal("0x");
    expect(transactionReceipt)
      .to.have.property("contractAddress")
      .to.equal("0x");
    expect(transactionReceipt).to.have.property("transactionIndex"); //.to.equal("0x");
    expect(transactionReceipt)
      .to.have.property("gasUsed")
      .to.equal(parseEther("0"));
    expect(transactionReceipt).to.have.property("logsBloom").to.equal("");
    expect(transactionReceipt).to.have.property("blockHash"); //.to.equal("0x");
    expect(transactionReceipt).to.have.property("transactionHash"); //.to.equal("0x");
    expect(transactionReceipt).to.have.property("logs").to.deep.equal([]);
    expect(transactionReceipt).to.have.property("blockNumber"); //.to.equal("0x");
    expect(transactionReceipt).to.have.property("confirmations").to.equal(1);
    expect(transactionReceipt)
      .to.have.property("cumulativeGasUsed")
      .to.equal(parseEther("0"));
    expect(transactionReceipt)
      .to.have.property("effectiveGasPrice")
      .to.equal(parseEther("0"));
    expect(transactionReceipt).to.have.property("byzantium").to.equal(false);
    expect(transactionReceipt).to.have.property("type").to.equal(2);
  });
});

// describe("JsonRpcProvider", () => {
//   beforeEach(() => {
//     rpcUrl = "http://localhost:8545";
//     regularProvider = new JsonRpcProvider(rpcUrl);
//     regularSigner = regularProvider.getSigner();
//   });
// });
