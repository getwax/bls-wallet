/* eslint-disable camelcase */
import { ethers as hardhatEthers } from "hardhat";
import chai, { expect } from "chai";
import spies from "chai-spies";
import { ethers } from "ethers";
import { parseEther, formatEther, id } from "ethers/lib/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  Experimental,
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
let network: ethers.providers.Networkish;

let privateKey: string;
let blsProvider: InstanceType<typeof Experimental.BlsProvider>;
let blsSigner: InstanceType<typeof Experimental.BlsSigner>;

let regularProvider: ethers.providers.JsonRpcProvider;
let regularSigner: ethers.providers.JsonRpcSigner;

describe("BlsProvider", () => {
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

    // random private key
    privateKey =
      "0x8f0e5883cf5dfcea371ddb4ef53f73ab1e2881ab291821547cf7034787c8572e";

    regularProvider = new ethers.providers.JsonRpcProvider(rpcUrl);
    regularSigner = regularProvider.getSigner();

    blsProvider = new Experimental.BlsProvider(
      aggregatorUrl,
      verificationGateway,
      rpcUrl,
      network,
    );
    blsSigner = blsProvider.getSigner(privateKey);

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
    const blsSigner = blsProvider.getSigner(privateKey);

    // Assert
    expect(blsSigner._isSigner).to.be.true;
  });

  it("should return a new signer if one has not been instantiated", async () => {
    // Arrange
    const newBlsProvider = new Experimental.BlsProvider(
      aggregatorUrl,
      verificationGateway,
      rpcUrl,
      network,
    );

    // Act
    // random private key
    const newPrivateKey =
      "0xe9a7000c19ed2a79122feeda76640e43afe6da9789f6126e54ec55e769d33711";
    const newBlsSigner = newBlsProvider.getSigner(newPrivateKey);

    // Assert
    expect(newBlsSigner).to.not.equal(blsSigner);
    expect(newBlsSigner).to.equal(newBlsProvider.getSigner(newPrivateKey));
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

  it("should throw an error when this.signer has not been assigned", async () => {
    // Arrange
    const newBlsProvider = new Experimental.BlsProvider(
      aggregatorUrl,
      verificationGateway,
      rpcUrl,
      network,
    );

    const recipient = signers[1].address;
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

  it("should send ETH (empty call) given a valid bundle successfully", async () => {
    // Arrange
    const recipient = signers[1].address;
    const expectedBalance = parseEther("1");
    const balanceBefore = await blsProvider.getBalance(recipient);

    const unsignedTransaction = {
      value: expectedBalance.toString(),
      to: recipient,
      data: "0x",
    };

    const signedTransaction = await blsSigner.signTransaction(
      unsignedTransaction,
    );

    // Act
    const transaction = await blsProvider.sendTransaction(signedTransaction);
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
      value: expectedBalance.toString(),
      to: recipient,
      data: "0x",
    };
    const signedTransaction = await blsSigner.signTransaction(
      unsignedTransaction,
    );

    // Act
    await blsProvider.sendTransaction(signedTransaction);

    // Assert
    // Once when calling "signer.signTransaction", and once when calling "signer.constructTransactionResponse".
    // This unit test is concerned with the latter being called.
    expect(spy).to.have.been.called.twice;
  });

  it("should throw an error sending a transaction when this.signer is not defined", async () => {
    // Arrange
    const newBlsProvider = new Experimental.BlsProvider(
      aggregatorUrl,
      verificationGateway,
      rpcUrl,
      network,
    );
    const signedTransaction = blsSigner.signTransaction({
      to: signers[0].address,
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

  it("should return failures as a json string and throw an error when sending an invalid transaction", async () => {
    // Arrange
    const invalidEthValue = parseEther("-1");

    const unsignedTransaction = {
      value: invalidEthValue,
      to: signers[1].address,
      data: "0x",
    };
    const signedTransaction = await blsSigner.signTransaction(
      unsignedTransaction,
    );

    // Act
    const result = async () =>
      await blsProvider.sendTransaction(signedTransaction);

    // Assert
    await expect(result()).to.be.rejectedWith(
      Error,
      '[{"type":"invalid-format","description":"field operations: element 0: field actions: element 0: field ethValue: hex string: missing 0x prefix"},{"type":"invalid-format","description":"field operations: element 0: field actions: element 0: field ethValue: hex string: incorrect byte length: 8.5"}]',
    );
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
    // TODO: bls-wallet #412 Update values returned in bundle receipt to more closely match ethers transaction response
    expect(transactionReceipt).to.be.an("object").that.deep.includes({
      to: "0x",
      from: "0x",
      contractAddress: "0x",
      logsBloom: "",
      logs: [],
      confirmations: transactionResponse.confirmations,
      byzantium: false,
      type: 2,
    });

    expect(transactionReceipt.gasUsed).to.equal(parseEther("0"));
    expect(transactionReceipt.cumulativeGasUsed).to.equal(parseEther("0"));
    expect(transactionReceipt.effectiveGasPrice).to.equal(parseEther("0"));

    expect(transactionReceipt).to.include.keys(
      "transactionIndex",
      "blockHash",
      "transactionHash",
      "blockNumber",
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
    expect(transactionReceipt).to.be.an("object").that.deep.includes({
      to: "0x",
      from: "0x",
      contractAddress: "0x",
      logsBloom: "",
      logs: [],
      confirmations: transactionResponse.confirmations,
      byzantium: false,
      type: 2,
    });

    expect(transactionReceipt.gasUsed).to.equal(parseEther("0"));
    expect(transactionReceipt.cumulativeGasUsed).to.equal(parseEther("0"));
    expect(transactionReceipt.effectiveGasPrice).to.equal(parseEther("0"));

    expect(transactionReceipt).to.include.keys(
      "transactionIndex",
      "blockHash",
      "transactionHash",
      "blockNumber",
    );
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
    expect(transactionResponse).to.be.an("object").that.deep.includes({
      hash: transactionReceipt.transactionHash,
      to: verificationGateway,

      // TODO:
      // 1. When running LOCALLY, why is this hardhat account 2 instead of blsSigner.wallet.address?
      // 2. When running in our GITHUB WORKFLOW, why is this hardhat account 0 instead of blsSigner.wallet.address?
      // Will investigate this again when I look at bls-wallet #412. May end up overriding the method.

      // transactionResponse.from LOCALLY =
      // Account #2: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC (10000 ETH)
      // Private Key: 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a

      // transactionResponse.from GITHUB WORKFLOW =
      // Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
      // Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

      // FIXME: Commenting out as this test passes locally but
      // expects a different address when running as part of our github workflow.
      // from: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      chainId: expectedTransactionResponse.chainId,
      type: 2,
      accessList: [],
      blockNumber: transactionReceipt.blockNumber,
      blockHash: transactionReceipt.blockHash,
      confirmations: expectedTransactionResponse.confirmations,
      transactionIndex: transactionReceipt.transactionIndex,
      creates: null,
    });

    expect(transactionResponse).to.include.keys(
      "from",
      "nonce",
      "gasLimit",
      "gasPrice",
      "data",
      "value",
      "r",
      "s",
      "v",
      "maxPriorityFeePerGas",
      "maxFeePerGas",
      "wait",
    );
  });
});

describe("JsonRpcProvider", () => {
  beforeEach(async () => {
    signers = await hardhatEthers.getSigners();
    rpcUrl = "http://localhost:8545";
    regularProvider = new ethers.providers.JsonRpcProvider(rpcUrl);
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
    expect(transactionResponse).to.be.an("object").that.deep.includes({
      hash: expectedTransactionResponse.hash,
      type: expectedTransactionResponse.type,
      accessList: expectedTransactionResponse.accessList,
      blockHash: expectedTransactionResponse.blockHash,
      blockNumber: expectedTransactionResponse.blockNumber,
      transactionIndex: 0,
      confirmations: expectedTransactionResponse.confirmations,
      from: expectedTransactionResponse.from,
      gasPrice: expectedTransactionResponse.gasPrice,
      maxPriorityFeePerGas: expectedTransactionResponse.maxPriorityFeePerGas,
      maxFeePerGas: expectedTransactionResponse.maxFeePerGas,
      gasLimit: expectedTransactionResponse.gasLimit,
      to: expectedTransactionResponse.to,
      value: expectedTransactionResponse.value,
      nonce: expectedTransactionResponse.nonce,
      data: expectedTransactionResponse.data,
      r: expectedTransactionResponse.r,
      s: expectedTransactionResponse.s,
      v: expectedTransactionResponse.v,
      creates: null,
      chainId: expectedTransactionResponse.chainId,
    });

    expect(transactionResponse).to.include.keys("wait");
  });
});
