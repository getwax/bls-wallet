import { ethers } from "hardhat";
import chai, { expect } from "chai";
import spies from "chai-spies";
import { Wallet } from "@ethersproject/wallet";
import { JsonRpcProvider, JsonRpcSigner } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Networkish } from "@ethersproject/networks";
import { parseEther, formatEther, id } from "ethers/lib/utils";

import {
  BlsProvider,
  BlsSigner,
  BlsWalletWrapper,
  MockERC20__factory,
  NetworkConfig,
} from "../clients/src";
import getNetworkConfig from "../shared/helpers/getNetworkConfig";

chai.use(spies);

let networkConfig: NetworkConfig;
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

describe("BlsProvider", () => {
  beforeEach(async () => {
    networkConfig = await getNetworkConfig("local");
    signers = await ethers.getSigners();

    aggregatorUrl = "http://localhost:3000";
    verificationGateway = networkConfig.addresses.verificationGateway;
    rpcUrl = "http://localhost:8545";
    network = {
      name: "localhost",
      chainId: 0x7a69,
    };
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
      to: blsSigner.wallet.address,
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

  it("calls a getter method on a contract using call()", async () => {
    // Arrange
    const expectedSupply = "1000000.0";
    const testERC20 = MockERC20__factory.connect(
      networkConfig.addresses.testToken,
      blsProvider,
    );

    const transaction = {
      to: testERC20.address,
      data: testERC20.interface.encodeFunctionData("totalSupply"),
    };

    // Act
    const result = await blsProvider.call(transaction);

    // Assert
    expect(formatEther(result)).to.equal(expectedSupply);
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
    const invalidValue = parseEther("-1");
    const transactionRequest = {
      to: recipient,
      value: invalidValue,
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
      "Transaction.to should be defined.",
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
    await blsProvider.sendBlsTransaction(signedTransaction, blsSigner);

    // Assert
    // Once when calling "signer.signTransaction", and once when calling "signer.constructTransactionResponse". This unit test is concerned with the latter being called.
    expect(spy).to.have.been.called.twice;
  });

  it("should return failures as a json string and throw an error when sending an invalid transaction", async () => {
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
      '[{"type":"invalid-format","description":"field operations: element 0: field actions: element 0: field ethValue: hex string: missing 0x prefix"},{"type":"invalid-format","description":"field operations: element 0: field actions: element 0: field ethValue: hex string: incorrect byte length: 8.5"}]',
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
    // TODO: bls-wallet #412 Update values returned in bundle receipt to more closely match ethers transaction response
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
    const invalidTransactionHash = id("invalid hash");
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
      `Could not find bundle receipt for transaction hash: ${invalidTransactionHash}.`,
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
    // TODO: bls-wallet #412 Update values returned in bundle receipt to more closely match ethers transaction response
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

  it("gets a transaction given a valid transaction hash", async () => {
    // Arrange
    const recipient = signers[1].address;
    const transactionAmount = parseEther("1");
    const transactionRequest = {
      to: recipient,
      value: transactionAmount,
    };

    const expectedTransactionResponse = await blsSigner.sendTransaction(
      transactionRequest,
    );
    const transactionReceipt = await expectedTransactionResponse.wait();

    // Act
    const transactionResponse = await blsProvider.getTransaction(
      transactionReceipt.transactionHash,
    );

    // Assert
    // TODO: bls-wallet #412 Update values returned in bundle receipt to more closely match ethers transaction response
    expect(transactionResponse).to.be.an("object");
    expect(transactionResponse)
      .to.have.property("hash")
      .to.equal(transactionReceipt.transactionHash);
    expect(transactionResponse).to.have.property("type").to.equal(2);
    expect(transactionResponse)
      .to.have.property("accessList")
      .to.deep.equal([]);
    expect(transactionResponse)
      .to.have.property("blockHash")
      .to.equal(transactionReceipt.blockHash);
    expect(transactionResponse)
      .to.have.property("blockNumber")
      .to.equal(transactionReceipt.blockNumber);
    expect(transactionResponse)
      .to.have.property("transactionIndex")
      .to.equal(transactionReceipt.transactionIndex);
    expect(transactionResponse)
      .to.have.property("confirmations")
      .to.equal(expectedTransactionResponse.confirmations);
    // TODO: Why is this different to signer wallet address? Uncomment logs below and run test to see problem.
    // Will investigate this again when I look at bls-wallet #412.
    // console.log("blsSigner wallet.address", blsSigner.wallet.address);
    // console.log("Signer from:            ", expectedTransactionResponse.from);
    expect(transactionResponse)
      .to.have.property("from")
      .to.equal("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC");
    expect(transactionResponse).to.have.property("gasPrice");
    expect(transactionResponse).to.have.property("maxPriorityFeePerGas");
    expect(transactionResponse).to.have.property("maxFeePerGas");
    expect(transactionResponse).to.have.property("gasLimit");
    expect(transactionResponse)
      .to.have.property("to")
      .to.equal(verificationGateway);
    expect(transactionResponse).to.have.property("value");
    expect(transactionResponse).to.have.property("nonce");
    expect(transactionResponse).to.have.property("data");
    expect(transactionResponse).to.have.property("r");
    expect(transactionResponse).to.have.property("s");
    expect(transactionResponse).to.have.property("v");
    expect(transactionResponse).to.have.property("creates").to.equal(null);
    expect(transactionResponse)
      .to.have.property("chainId")
      .to.equal(expectedTransactionResponse.chainId);
    expect(transactionResponse).to.have.property("wait");
  });
});

describe("JsonRpcProvider", () => {
  beforeEach(async () => {
    signers = await ethers.getSigners();
    rpcUrl = "http://localhost:8545";
    regularProvider = new JsonRpcProvider(rpcUrl);
    regularSigner = regularProvider.getSigner();
  });

  it("calls a getter method on a contract", async () => {
    // Arrange
    const expectedSupply = "1000000.0";
    const testERC20 = MockERC20__factory.connect(
      networkConfig.addresses.testToken,
      regularProvider,
    );

    const transaction = {
      to: testERC20.address,
      data: testERC20.interface.encodeFunctionData("totalSupply"),
    };

    // Act
    const result = await regularProvider.call(transaction);

    // Assert
    expect(formatEther(result)).to.equal(expectedSupply);
  });

  it("gets a transaction given a valid transaction hash", async () => {
    // Arrange
    const recipient = signers[1].address;
    const transactionAmount = parseEther("1");
    const transactionRequest = {
      to: recipient,
      value: transactionAmount,
    };

    const expectedTransactionResponse = await regularSigner.sendTransaction(
      transactionRequest,
    );

    // Act
    const transactionResponse = await regularProvider.getTransaction(
      expectedTransactionResponse.hash,
    );

    // Assert
    expect(transactionResponse).to.be.an("object");
    expect(transactionResponse)
      .to.have.property("hash")
      .to.equal(expectedTransactionResponse.hash);
    expect(transactionResponse)
      .to.have.property("type")
      .to.equal(expectedTransactionResponse.type);
    expect(transactionResponse)
      .to.have.property("accessList")
      .to.deep.equal(expectedTransactionResponse.accessList);
    expect(transactionResponse)
      .to.have.property("blockHash")
      .to.equal(expectedTransactionResponse.blockHash);
    expect(transactionResponse)
      .to.have.property("blockNumber")
      .to.equal(expectedTransactionResponse.blockNumber);
    expect(transactionResponse)
      .to.have.property("transactionIndex")
      .to.equal(0);
    expect(transactionResponse)
      .to.have.property("confirmations")
      .to.equal(expectedTransactionResponse.confirmations);
    expect(transactionResponse)
      .to.have.property("from")
      .to.equal(expectedTransactionResponse.from);
    expect(transactionResponse)
      .to.have.property("gasPrice")
      .to.equal(expectedTransactionResponse.gasPrice);
    expect(transactionResponse)
      .to.have.property("maxPriorityFeePerGas")
      .to.equal(expectedTransactionResponse.maxPriorityFeePerGas);
    expect(transactionResponse)
      .to.have.property("maxFeePerGas")
      .to.equal(expectedTransactionResponse.maxFeePerGas);
    expect(transactionResponse)
      .to.have.property("gasLimit")
      .to.equal(expectedTransactionResponse.gasLimit);
    expect(transactionResponse)
      .to.have.property("to")
      .to.equal(expectedTransactionResponse.to);
    expect(transactionResponse)
      .to.have.property("value")
      .to.equal(expectedTransactionResponse.value);
    expect(transactionResponse)
      .to.have.property("nonce")
      .to.equal(expectedTransactionResponse.nonce);
    expect(transactionResponse)
      .to.have.property("data")
      .to.equal(expectedTransactionResponse.data);
    expect(transactionResponse)
      .to.have.property("r")
      .to.equal(expectedTransactionResponse.r);
    expect(transactionResponse)
      .to.have.property("s")
      .to.equal(expectedTransactionResponse.s);
    expect(transactionResponse)
      .to.have.property("v")
      .to.equal(expectedTransactionResponse.v);
    expect(transactionResponse).to.have.property("creates").to.equal(null);
    expect(transactionResponse)
      .to.have.property("chainId")
      .to.equal(expectedTransactionResponse.chainId);
    expect(transactionResponse).to.have.property("wait");
  });
});
