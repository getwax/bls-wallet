import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { JsonRpcProvider, JsonRpcSigner } from "@ethersproject/providers";
import { ethers } from "hardhat";
import { Wallet } from "ethers";
import { TransactionRequest } from "@ethersproject/abstract-provider";
import { Networkish } from "@ethersproject/networks";

import BlsSigner from "../clients/src/BlsSigner";
import BlsProvider from "../clients/src/BlsProvider";
import { expect, assert } from "chai";
import { formatEther, parseEther } from "ethers/lib/utils";

describe("BlsProvider tests", () => {
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

  it("should return a valid signer successfully", async () => {
    // Arrange & Act
    const blsSigner = blsProvider.getSigner();

    // Assert
    expect(blsSigner._isSigner).to.true;
  });

  // it("'call' executes a transaction successfully", async () => {
  //   // Arrange
  //   // Act
  //   // Assert
  // });

  it.only("'estimateGas' returns an estimate for the amount of gas required in a transaction successfully", async () => {
    // Arrange
    const recipient = signers[1].address;
    const transactionAmount = parseEther("1");
    const transactionRequest = {
      to: recipient,
      value: transactionAmount,
    };

    // Act
    const gasEstimate = await blsProvider.estimateGas(transactionRequest);
    console.log("gasEstimate", gasEstimate);
    
    // Assert
  });

  // it("'getTransaction' returns the transaction with hash", async () => {
  //   // Arrange
  //   // Act
  //   // Assert
  // });

  // it("'getTransactionReceipt' returns the transaction receipt given correct hash", async () => {
  //   // Arrange
  //   // Act
  //   // Assert
  // });

  it("blsProvider 'sendTransaction' sends a transaction successfully", async () => {
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

  it("blsProvider 'getTransactionReceipt' should get a transaction receipt successfully", async () => {
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
    // expect(transactionReceipt)
    //   .to.have.property("transactionIndex")
    //   .to.equal("0x");
    expect(transactionReceipt)
      .to.have.property("gasUsed")
      .to.equal(parseEther("0"));
    expect(transactionReceipt).to.have.property("logsBloom").to.equal("");
    // expect(transactionReceipt).to.have.property("blockHash").to.equal("0x");
    // expect(transactionReceipt)
    //   .to.have.property("transactionHash")
    //   .to.equal("0x");
    expect(transactionReceipt).to.have.property("logs").to.deep.equal([]);
    // expect(transactionReceipt).to.have.property("blockNumber").to.equal("0x");
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

  // TODO: is "included in the block" terminology correct?
  it("'waitForTransaction' should resolve once transaction hash is included in the block", async () => {
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
      0,
    );

    // Assert
    // TODO: How do we test the assertions commented out as the bundle receipt is received as part of the _getTransactionReceipt() method?
    expect(transactionReceipt).to.be.an("object");
    expect(transactionReceipt).to.have.property("to").to.equal("0x");
    expect(transactionReceipt).to.have.property("from").to.equal("0x");
    expect(transactionReceipt)
      .to.have.property("contractAddress")
      .to.equal("0x");
    // expect(transactionReceipt)
    //   .to.have.property("transactionIndex")
    //   .to.equal("0x");
    expect(transactionReceipt)
      .to.have.property("gasUsed")
      .to.equal(parseEther("0"));
    expect(transactionReceipt).to.have.property("logsBloom").to.equal("");
    // expect(transactionReceipt).to.have.property("blockHash").to.equal("0x");
    // expect(transactionReceipt)
    //   .to.have.property("transactionHash")
    //   .to.equal("0x");
    expect(transactionReceipt).to.have.property("logs").to.deep.equal([]);
    // expect(transactionReceipt).to.have.property("blockNumber").to.equal("0x");
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
