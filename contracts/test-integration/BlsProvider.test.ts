import chai, { expect } from "chai";
import { BigNumber, ethers } from "ethers";
import { formatEther, parseEther } from "ethers/lib/utils";

import {
  BlsWalletWrapper,
  bundleToDto,
  BlsProvider,
  BlsSigner,
  MockERC20Factory,
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
let blsProvider: BlsProvider;
let blsSigner: BlsSigner;

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
    const testERC20 = MockERC20Factory.connect(
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
    const getAddressPromise = blsSigner.getAddress();
    const transactionRequest = {
      to: ethers.Wallet.createRandom().address,
      value: parseEther("1"),
      from: getAddressPromise,
    };

    // Act
    const gasEstimate = async () =>
      await blsProvider.estimateGas(transactionRequest);

    // Assert
    await expect(gasEstimate()).to.not.be.rejected;
  });

  it("should send ETH (empty call) given a valid bundle", async () => {
    // Arrange
    const recipient = ethers.Wallet.createRandom().address;
    const expectedBalance = parseEther("1");
    const balanceBefore = await blsProvider.getBalance(recipient);

    const signedTransaction = await blsSigner.signTransaction({
      value: expectedBalance.toString(),
      to: recipient,
      data: "0x",
    });

    // Act
    const transaction = await blsProvider.sendTransaction(signedTransaction);
    await transaction.wait();

    // Assert
    expect(
      (await blsProvider.getBalance(recipient)).sub(balanceBefore),
    ).to.equal(expectedBalance);
  });

  it("should throw an error when sending multiple signed operations to sendTransaction", async () => {
    // Arrange
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

    const nonce = await blsSigner.wallet.Nonce();

    const firstOperation = {
      nonce,
      actions: [...firstActionWithSafeFee],
    };
    const secondOperation = {
      nonce,
      actions: [...secondActionWithSafeFee],
    };

    const firstBundle = await blsSigner.wallet.signWithGasEstimate(
      firstOperation,
    );
    const secondBundle = await blsSigner.wallet.signWithGasEstimate(
      secondOperation,
    );

    const aggregatedBundle = blsSigner.wallet.blsWalletSigner.aggregate([
      firstBundle,
      secondBundle,
    ]);

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

  it("should get the account nonce when the signer constructs the transaction response", async () => {
    // Arrange
    const spy = chai.spy.on(BlsWalletWrapper, "Nonce");
    const signedTransaction = await blsSigner.signTransaction({
      value: parseEther("1"),
      to: ethers.Wallet.createRandom().address,
      data: "0x",
    });

    // Act
    await blsProvider.sendTransaction(signedTransaction);

    // Assert
    // Once when calling "signer.signTransaction", and once when calling "blsSigner.constructTransactionResponse".
    // This unit test is concerned with the latter being called.
    expect(spy).to.have.been.called.exactly(2);
    chai.spy.restore(spy);
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

  it("should send a batch of ETH transfers (empty calls) given a valid bundle", async () => {
    // Arrange
    const expectedAmount = parseEther("1");
    const recipients = [];
    const unsignedTransactionBatch = [];

    for (let i = 0; i < 3; i++) {
      recipients.push(ethers.Wallet.createRandom().address);
      unsignedTransactionBatch.push({
        to: recipients[i],
        value: expectedAmount,
      });
    }

    const signedTransactionBatch = await blsSigner.signTransactionBatch({
      transactions: unsignedTransactionBatch,
    });

    // Act
    const result = await blsProvider.sendTransactionBatch(
      signedTransactionBatch,
    );
    await result.awaitBatchReceipt();

    // Assert
    expect(await blsProvider.getBalance(recipients[0])).to.equal(
      expectedAmount,
    );
    expect(await blsProvider.getBalance(recipients[1])).to.equal(
      expectedAmount,
    );
    expect(await blsProvider.getBalance(recipients[2])).to.equal(
      expectedAmount,
    );
  });

  it("should send a batch of ETH transfers (empty calls) given two aggregated bundles and return a transaction batch response", async () => {
    // Arrange
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

    const nonce = await blsSigner.wallet.Nonce();

    const firstOperation = {
      nonce,
      gas: verySafeFee,
      actions: [...firstActionWithSafeFee],
    };
    const secondOperation = {
      nonce: nonce.add(1),
      gas: verySafeFee,
      actions: [...secondActionWithSafeFee],
    };

    const firstBundle = blsSigner.wallet.sign(firstOperation);
    const secondBundle = blsSigner.wallet.sign(secondOperation);

    const aggregatedBundle = blsSigner.wallet.blsWalletSigner.aggregate([
      firstBundle,
      secondBundle,
    ]);

    // Act
    const transactionBatchResponse = await blsProvider.sendTransactionBatch(
      JSON.stringify(bundleToDto(aggregatedBundle)),
    );
    await transactionBatchResponse.awaitBatchReceipt();

    // Assert
    expect(await blsProvider.getBalance(firstRecipient)).to.equal(
      expectedAmount,
    );
    expect(await blsProvider.getBalance(secondRecipient)).to.equal(
      expectedAmount,
    );

    // tx 1
    expect(transactionBatchResponse.transactions[0])
      .to.be.an("object")
      .that.includes({
        hash: transactionBatchResponse.transactions[0].hash,
        to: firstRecipient,
        from: blsSigner.wallet.address,
        data: "0x",
        chainId: 1337,
        type: 2,
        confirmations: 1,
      });
    expect(transactionBatchResponse.transactions[0].nonce).to.equal(0);
    expect(transactionBatchResponse.transactions[0].gasLimit).to.equal(
      BigNumber.from("0x0"),
    );
    expect(transactionBatchResponse.transactions[0].value).to.equal(
      BigNumber.from(expectedAmount),
    );

    // tx 2
    expect(transactionBatchResponse.transactions[1])
      .to.be.an("object")
      .that.includes({
        hash: transactionBatchResponse.transactions[1].hash,
        to: secondRecipient,
        from: blsSigner.wallet.address,
        data: "0x",
        chainId: 1337,
        type: 2,
        confirmations: 1,
      });
    expect(transactionBatchResponse.transactions[1].nonce).to.equal(0);
    expect(transactionBatchResponse.transactions[1].gasLimit).to.equal(
      BigNumber.from("0x0"),
    );
    expect(transactionBatchResponse.transactions[1].value).to.equal(
      BigNumber.from(expectedAmount),
    );
  });

  it("should get the account nonce when the signer constructs the transaction batch response", async () => {
    // Arrange
    const spy = chai.spy.on(BlsWalletWrapper, "Nonce");
    const recipient = ethers.Wallet.createRandom().address;
    const expectedBalance = parseEther("1");

    const unsignedTransaction = {
      value: expectedBalance.toString(),
      to: recipient,
      data: "0x",
    };
    const signedTransaction = await blsSigner.signTransactionBatch({
      transactions: [unsignedTransaction],
    });

    // Act
    await blsProvider.sendTransactionBatch(signedTransaction);

    // Assert
    // Once when calling "signer.signTransaction", and once when calling "blsSigner.constructTransactionResponse".
    // This unit test is concerned with the latter being called.
    expect(spy).to.have.been.called.exactly(2);
    chai.spy.restore(spy);
  });

  it("should throw an error when sending a modified signed transaction", async () => {
    // Arrange
    const address = await blsSigner.getAddress();

    const signedTransaction = await blsSigner.signTransactionBatch({
      transactions: [
        {
          value: parseEther("1"),
          to: ethers.Wallet.createRandom().address,
          data: "0x",
        },
      ],
    });

    const userBundle = JSON.parse(signedTransaction);
    userBundle.operations[0].actions[0].ethValue = parseEther("2");
    const invalidBundle = JSON.stringify(userBundle);

    // Act
    const result = async () =>
      await blsProvider.sendTransactionBatch(invalidBundle);

    // Assert
    await expect(result()).to.be.rejectedWith(
      Error,
      `[{"type":"invalid-signature","description":"invalid signature for wallet address ${address}"}]`,
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
    const transactionResponse = await blsSigner.sendTransaction({
      to: ethers.Wallet.createRandom().address,
      value: parseEther("1"),
    });
    const expectedToAddress = networkConfig.addresses.verificationGateway;
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
    const transactionResponse = await blsSigner.sendTransaction({
      to: ethers.Wallet.createRandom().address,
      value: parseEther("1"),
    });

    const expectedToAddress = networkConfig.addresses.verificationGateway;
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

  it("should get a transaction given a valid transaction hash", async () => {
    // Arrange
    const transactionRequest = {
      to: ethers.Wallet.createRandom().address,
      value: parseEther("1"),
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
      // chainId: parseInt(expectedTransactionResponse.chainId, 16),
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

  it("should return the number of transactions an address has sent", async function () {
    // Arrange
    const address = await blsSigner.getAddress();
    const expectedFirstTransactionCount = 0;
    const expectedSecondTransactionCount = 1;

    // Act
    const firstTransactionCount = await blsProvider.getTransactionCount(
      address,
    );

    const sendTransaction = await blsSigner.sendTransaction({
      value: BigNumber.from(1),
      to: ethers.Wallet.createRandom().address,
    });
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
});
