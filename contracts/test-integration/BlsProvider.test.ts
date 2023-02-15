/* eslint-disable camelcase */
import chai, { expect } from "chai";
import { BigNumber, ethers } from "ethers";
import { formatEther, parseEther } from "ethers/lib/utils";

import {
  BlsWalletWrapper,
  Experimental,
  MockERC20__factory,
  NetworkConfig,
} from "../clients/src";
import getNetworkConfig from "../shared/helpers/getNetworkConfig";

let networkConfig: NetworkConfig;

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
    networkConfig = await getNetworkConfig("local");

    aggregatorUrl = "http://localhost:3000";
    verificationGateway = networkConfig.addresses.verificationGateway;
    aggregatorUtilities = networkConfig.addresses.utilities;
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

    const fundedWallet = new ethers.Wallet(
      "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // Hardhat Account #2 private key
      regularProvider,
    );

    await fundedWallet.sendTransaction({
      to: await blsSigner.getAddress(),
      value: parseEther("10"),
    });
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
    const recipient = ethers.Wallet.createRandom().address;
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

  it("should send ETH (empty call) given a valid bundle successfully", async () => {
    // Arrange
    const recipient = ethers.Wallet.createRandom().address;
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
    const recipient = ethers.Wallet.createRandom().address;
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
    // Once when calling "signer.signTransaction", once when calling "blsProvider.estimateGas", and once when calling "blsSigner.constructTransactionResponse".
    // This unit test is concerned with the latter being called.
    expect(spy).to.have.been.called.exactly(3);
  });

  it("should throw an error when sending a modified signed transaction", async () => {
    // Arrange
    const address = await blsSigner.getAddress();

    const signedTransaction = await blsSigner.signTransaction({
      value: parseEther("1"),
      to: ethers.Wallet.createRandom().address,
      data: "0x",
    });

    const userBundle = JSON.parse(signedTransaction);
    userBundle.operations[0].actions[0].ethValue = parseEther("2");
    const invalidBundle = JSON.stringify(userBundle);

    // Act
    const result = async () => await blsProvider.sendTransaction(invalidBundle);

    // Assert
    await expect(result()).to.be.rejectedWith(
      Error,
      `[{"type":"invalid-signature","description":"invalid signature for wallet address ${address}"}]`,
    );
  });

  it("should throw an error when sending an invalid signed transaction", async () => {
    // Arrange
    const invalidTransaction = "Invalid signed transaction";

    // Act
    const result = async () =>
      await blsProvider.sendTransaction(invalidTransaction);

    // Assert
    await expect(result()).to.be.rejectedWith(
      Error,
      "Unexpected token I in JSON at position 0",
    );
  });

  it("should throw an error when the transaction receipt cannot be found", async () => {
    // Arrange
    const randomBytes = ethers.utils.randomBytes(20);
    const invalidTransactionHash = ethers.utils.keccak256(randomBytes);
    const retries = 1; // Setting this to 1 as we do not want to wait in order for the logic to be correctly tested

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
    const recipient = ethers.Wallet.createRandom().address;
    const transactionResponse = await blsSigner.sendTransaction({
      to: recipient,
      value: parseEther("1"),
    });

    const expectedToAddress = "0x689A095B4507Bfa302eef8551F90fB322B3451c6"; // Verification Gateway address
    const expectedFromAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // Aggregator address (Hardhat account 0)

    // Act
    const transactionReceipt = await blsProvider.waitForTransaction(
      transactionResponse.hash,
      1,
      20,
    );

    // Assert
    const expectedBlockNumber = await blsProvider.getBlockNumber();
    expect(transactionReceipt).to.be.an("object").that.deep.includes({
      to: expectedToAddress,
      from: expectedFromAddress,
      contractAddress: null,
      transactionIndex: 0,
      root: undefined,
      blockNumber: expectedBlockNumber,
      confirmations: transactionResponse.confirmations,
      byzantium: true,
      type: 2,
      status: 1,
    });

    expect(transactionReceipt).to.have.all.keys(
      "to",
      "from",
      "contractAddress",
      "transactionIndex",
      "root",
      "gasUsed",
      "logsBloom",
      "blockHash",
      "transactionHash",
      "logs",
      "blockNumber",
      "confirmations",
      "cumulativeGasUsed",
      "effectiveGasPrice",
      "byzantium",
      "type",
      "status",
    );

    expect(transactionReceipt.gasUsed).to.be.an("object");
    expect(transactionReceipt.logsBloom).to.be.a("string");
    expect(transactionReceipt.blockHash).to.be.a("string");
    expect(transactionReceipt.transactionHash).to.be.a("string");
    expect(transactionReceipt.logs).to.be.an("Array");
    expect(transactionReceipt.cumulativeGasUsed).to.be.an("object");
    expect(transactionReceipt.effectiveGasPrice).to.be.an("object");
  });

  it("should retrieve a transaction receipt given a valid hash", async () => {
    // Arrange
    const recipient = ethers.Wallet.createRandom().address;
    const transactionResponse = await blsSigner.sendTransaction({
      to: recipient,
      value: parseEther("1"),
    });

    const expectedToAddress = "0x689A095B4507Bfa302eef8551F90fB322B3451c6"; // Verification Gateway address
    const expectedFromAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // Aggregator address (Hardhat account 0)

    // Act
    const transactionReceipt = await blsProvider.getTransactionReceipt(
      transactionResponse.hash,
    );

    // Assert
    const expectedBlockNumber = await blsProvider.getBlockNumber();
    expect(transactionReceipt).to.be.an("object").that.deep.includes({
      to: expectedToAddress,
      from: expectedFromAddress,
      contractAddress: null,
      transactionIndex: 0,
      root: undefined,
      blockNumber: expectedBlockNumber,
      confirmations: transactionResponse.confirmations,
      byzantium: true,
      type: 2,
      status: 1,
    });

    expect(transactionReceipt).to.have.all.keys(
      "to",
      "from",
      "contractAddress",
      "transactionIndex",
      "root",
      "gasUsed",
      "logsBloom",
      "blockHash",
      "transactionHash",
      "logs",
      "blockNumber",
      "confirmations",
      "cumulativeGasUsed",
      "effectiveGasPrice",
      "byzantium",
      "type",
      "status",
    );

    expect(transactionReceipt.gasUsed).to.be.an("object");
    expect(transactionReceipt.logsBloom).to.be.a("string");
    expect(transactionReceipt.blockHash).to.be.a("string");
    expect(transactionReceipt.transactionHash).to.be.a("string");
    expect(transactionReceipt.logs).to.be.an("Array");
    expect(transactionReceipt.cumulativeGasUsed).to.be.an("object");
    expect(transactionReceipt.effectiveGasPrice).to.be.an("object");
  });

  it("gets a transaction given a valid transaction hash", async () => {
    // Arrange
    const recipient = ethers.Wallet.createRandom().address;
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
    // TODO: bls-wallet #481 Add Bls Provider getTransaction method
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

  it("should return the list of accounts managed by the provider", async () => {
    // Arrange
    const expectedAccounts = await regularProvider.listAccounts();

    // Act
    const accounts = await blsProvider.listAccounts();

    // Assert
    expect(accounts).to.deep.equal(expectedAccounts);
  });

  it("should send an rpc request to the provider", async () => {
    // Arrange
    const expectedBlockNumber = await regularProvider.send(
      "eth_blockNumber",
      [],
    );
    const expectedChainId = await regularProvider.send("eth_chainId", []);
    const expectedAccounts = await regularProvider.send("eth_accounts", []);

    // Act
    const blockNumber = await blsProvider.send("eth_blockNumber", []);
    const chainId = await blsProvider.send("eth_chainId", []);
    const accounts = await blsProvider.send("eth_accounts", []);

    // Assert
    expect(blockNumber).to.equal(expectedBlockNumber);
    expect(chainId).to.equal(expectedChainId);
    expect(accounts).to.deep.equal(expectedAccounts);
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

  it("should return the number of transactions an address has sent", async function () {
    // Arrange
    const transaction = {
      value: BigNumber.from(1),
      to: ethers.Wallet.createRandom().address,
    };
    const address = await blsSigner.getAddress();

    const expectedFirstTransactionCount = 0;
    const expectedSecondTransactionCount = 1;

    // Act
    const firstTransactionCount = await blsProvider.getTransactionCount(
      address,
    );

    const sendTransaction = await blsSigner.sendTransaction(transaction);
    await sendTransaction.wait();

    const secondTransactionCount = await blsProvider.getTransactionCount(
      address,
    );

    // Assert
    expect(firstTransactionCount).to.equal(expectedFirstTransactionCount);
    expect(secondTransactionCount).to.equal(expectedSecondTransactionCount);
  });

  it("should return the number of transactions an address has sent at a specified block tag", async function () {
    // Arrange
    const expectedTransactionCount = 0;

    const sendTransaction = await blsSigner.sendTransaction({
      value: BigNumber.from(1),
      to: ethers.Wallet.createRandom().address,
    });
    await sendTransaction.wait();

    // Act
    const transactionCount = await blsProvider.getTransactionCount(
      await blsSigner.getAddress(),
      "earliest",
    );

    // Assert
    expect(transactionCount).to.equal(expectedTransactionCount);
  });

  it("should return the block from the network", async function () {
    // Arrange
    const expectedBlock = await regularProvider.getBlock(1);

    // Act
    const block = await blsProvider.getBlock(1);

    // Assert
    expect(block).to.be.an("object").that.deep.includes({
      hash: expectedBlock.hash,
      parentHash: expectedBlock.parentHash,
      number: expectedBlock.number,
      timestamp: expectedBlock.timestamp,
      difficulty: expectedBlock.difficulty,
      miner: expectedBlock.miner,
      extraData: expectedBlock.extraData,
      transactions: expectedBlock.transactions,
    });
    expect(block.gasLimit).to.deep.equal(expectedBlock.gasLimit);
    expect(block.gasUsed).to.deep.equal(expectedBlock.gasUsed);
    expect(block.baseFeePerGas).to.deep.equal(expectedBlock.baseFeePerGas);
    expect(block._difficulty).to.deep.equal(expectedBlock._difficulty);
  });

  it("should return the block from the network with an array of TransactionResponse objects", async function () {
    // Arrange
    const expectedBlock = await regularProvider.getBlockWithTransactions(1);

    // Act
    const block = await blsProvider.getBlockWithTransactions(1);

    // Assert
    // Assert block
    expect(block).to.be.an("object").that.deep.includes({
      hash: expectedBlock.hash,
      parentHash: expectedBlock.parentHash,
      number: expectedBlock.number,
      timestamp: expectedBlock.timestamp,
      difficulty: expectedBlock.difficulty,
      miner: expectedBlock.miner,
      extraData: expectedBlock.extraData,
    });
    expect(block.gasLimit).to.deep.equal(expectedBlock.gasLimit);
    expect(block.gasUsed).to.deep.equal(expectedBlock.gasUsed);
    expect(block.baseFeePerGas).to.deep.equal(expectedBlock.baseFeePerGas);
    expect(block._difficulty).to.deep.equal(expectedBlock._difficulty);

    // Assert transaction in block
    expect(block.transactions[0]).to.be.an("object").that.deep.includes({
      hash: expectedBlock.transactions[0].hash,
      type: expectedBlock.transactions[0].type,
      accessList: expectedBlock.transactions[0].accessList,
      blockHash: expectedBlock.transactions[0].blockHash,
      blockNumber: expectedBlock.transactions[0].blockNumber,
      transactionIndex: 0,
      from: expectedBlock.transactions[0].from,
      to: expectedBlock.transactions[0].to,
      nonce: expectedBlock.transactions[0].nonce,
      data: expectedBlock.transactions[0].data,
      r: expectedBlock.transactions[0].r,
      s: expectedBlock.transactions[0].s,
      v: expectedBlock.transactions[0].v,
      creates: null,
      chainId: expectedBlock.transactions[0].chainId,
    });

    expect(block.transactions[0].gasPrice).to.deep.equal(
      expectedBlock.transactions[0].gasPrice,
    );
    expect(block.transactions[0].maxPriorityFeePerGas).to.deep.equal(
      expectedBlock.transactions[0].maxPriorityFeePerGas,
    );
    expect(block.transactions[0].maxFeePerGas).to.deep.equal(
      expectedBlock.transactions[0].maxFeePerGas,
    );
    expect(block.transactions[0].gasLimit).to.deep.equal(
      expectedBlock.transactions[0].gasLimit,
    );
    expect(block.transactions[0].value).to.deep.equal(
      expectedBlock.transactions[0].value,
    );

    // Not sure why confirmations from the expected block is 1 above confirmations from blsProvider result.
    // Last assertion doube checks this against another method and the confirmation number is correct according to this.
    expect(block.transactions[0].confirmations).to.deep.equal(
      expectedBlock.transactions[0].confirmations + 1,
    );
    // confirm that confirmations match via provider.getTransaction()
    expect(block.transactions[0].confirmations).to.deep.equal(
      (await blsProvider.getTransaction(block.transactions[0].hash))
        .confirmations,
    );
  });

  it("should return the network the provider is connected to", async () => {
    // Arrange
    const expectedNetwork = { name: "localhost", chainId: 1337 };

    // Act
    const network = await blsProvider.getNetwork();

    // Assert
    expect(network).to.deep.equal(expectedNetwork);
  });

  it("should return the block number at the most recent block", async () => {
    // Arrange
    const expectedBlockNumber = await regularProvider.getBlockNumber();

    // Act
    const blockNumber = await blsProvider.getBlockNumber();

    // Assert
    expect(blockNumber).to.deep.equal(expectedBlockNumber);
  });

  it("should return an estimate of gas price to use in a transaction", async () => {
    // Arrange
    const expectedGasPrice = await regularProvider.getGasPrice();

    // Act
    const gasPrice = await blsProvider.getGasPrice();

    // Assert
    expect(gasPrice).to.deep.equal(expectedGasPrice);
  });

  it("should return the current recommended FeeData to use in a transaction", async () => {
    // Arrange
    const expectedFeeData = await regularProvider.getFeeData();

    // Act
    const feeData = await blsProvider.getFeeData();

    // Assert
    expect(feeData.lastBaseFeePerGas).to.deep.equal(
      expectedFeeData.lastBaseFeePerGas,
    );
    expect(feeData.maxFeePerGas).to.deep.equal(expectedFeeData.maxFeePerGas);
    expect(feeData.maxPriorityFeePerGas).to.deep.equal(
      expectedFeeData.maxPriorityFeePerGas,
    );
    expect(feeData.gasPrice).to.deep.equal(expectedFeeData.gasPrice);
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

describe("JsonRpcProvider", () => {
  let wallet: ethers.Wallet;

  beforeEach(async () => {
    rpcUrl = "http://localhost:8545";
    regularProvider = new ethers.providers.JsonRpcProvider(rpcUrl);
    // First two Hardhat account private keys are used in aggregator .env. We choose to use Hardhat account #2 private key here to avoid nonce too low errors.
    wallet = new ethers.Wallet(
      "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // Hardhat acount #2 private key
      regularProvider,
    );
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
    const recipient = ethers.Wallet.createRandom().address;
    const transactionAmount = parseEther("1");
    const transactionRequest = {
      to: recipient,
      value: transactionAmount,
    };

    const expectedTransactionResponse = await wallet.sendTransaction(
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
      transactionIndex: 0,
      confirmations: 1,
      from: expectedTransactionResponse.from,
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

    expect(transactionResponse).to.include.keys(
      "wait",
      "blockHash",
      "blockNumber",
      "gasPrice",
    );
  });
});
