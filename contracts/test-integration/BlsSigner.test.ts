/* eslint-disable camelcase */
import chai, { expect } from "chai";
import { ethers, BigNumber } from "ethers";
import { parseEther, resolveProperties, formatEther } from "ethers/lib/utils";
import sinon from "sinon";

import {
  BlsProvider,
  BlsSigner,
  ActionData,
  BlsWalletWrapper,
  NetworkConfig,
  MockERC20Factory,
} from "../clients/src";
import getNetworkConfig from "../shared/helpers/getNetworkConfig";
import addSafetyPremiumToFee from "../clients/src/helpers/addSafetyDivisorToFee";

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
let fundedWallet: ethers.Wallet;

describe("BlsSigner", () => {
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

    fundedWallet = new ethers.Wallet(
      "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // Hardhat Account #2 private key
      regularProvider,
    );

    await fundedWallet.sendTransaction({
      to: await blsSigner.getAddress(),
      value: parseEther("10"),
    });
  });

  afterEach(() => {
    chai.spy.restore();
    sinon.restore();
  });

  it("should send ETH (empty call) successfully", async () => {
    // Arrange
    const recipient = ethers.Wallet.createRandom().address;
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

  it("should throw an error when sending an invalid transaction", async () => {
    // Arrange
    const invalidValue = parseEther("-1");

    // Act
    const result = async () =>
      await blsSigner.sendTransaction({
        to: ethers.Wallet.createRandom().address,
        value: invalidValue,
      });

    // Assert
    await expect(result()).to.be.rejectedWith(
      Error,
      'value out-of-bounds (argument="ethValue", value="-1000000000000000000", code=INVALID_ARGUMENT, version=abi/5.7.0)',
    );
  });

  it("should return a transaction response when sending a transaction", async () => {
    // Arrange
    const recipient = ethers.Wallet.createRandom().address;
    const transactionAmount = parseEther("1");
    const expectedNonce = await BlsWalletWrapper.Nonce(
      blsSigner.wallet.PublicKey(),
      blsSigner.verificationGatewayAddress,
      blsProvider,
    );

    // Act
    const transactionResponse = await blsSigner.sendTransaction({
      to: recipient,
      value: transactionAmount,
      data: "0x",
    });

    // Assert
    expect(transactionResponse).to.be.an("object").that.includes({
      hash: transactionResponse.hash,
      to: recipient,
      from: blsSigner.wallet.address,
      data: "0x",
      chainId: 1337,
      type: 2,
      confirmations: 1,
    });

    expect(transactionResponse.nonce).to.equal(expectedNonce);
    expect(transactionResponse.gasLimit).to.equal(BigNumber.from("0x0"));
    expect(transactionResponse.value).to.equal(
      BigNumber.from(transactionAmount),
    );
  });

  it("should send a batch of ETH transfers (empty calls) successfully", async () => {
    // Arrange
    const spy = chai.spy.on(BlsWalletWrapper, "Nonce");

    const expectedAmount = parseEther("1");
    const recipients = [];
    const transactionBatch = [];

    for (let i = 0; i < 3; i++) {
      recipients.push(ethers.Wallet.createRandom().address);
      transactionBatch.push({
        to: recipients[i],
        value: expectedAmount,
      });
    }

    // Act
    const transaction = await blsSigner.sendTransactionBatch({
      transactions: transactionBatch,
    });
    await transaction.awaitBatchReceipt();

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

    // Nonce is not supplied with batch options so spy should be called once in sendTransactionBatch
    expect(spy).to.have.been.called.exactly(1);
  });

  it("should not retrieve nonce when sending a transaction batch with batch options", async () => {
    // Arrange
    const spy = chai.spy.on(BlsWalletWrapper, "Nonce");

    const recipient = ethers.Wallet.createRandom().address;
    const expectedAmount = parseEther("1");

    const transactionBatch = {
      transactions: [
        {
          to: recipient,
          value: expectedAmount,
        },
      ],
      batchOptions: {
        gas: ethers.utils.parseUnits("40000"),
        maxPriorityFeePerGas: ethers.utils.parseUnits("0.5", "gwei"),
        maxFeePerGas: ethers.utils.parseUnits("23", "gwei"),
        nonce: 0,
        chainId: 1337,
        accessList: [],
      },
    };

    // Act
    const transaction = await blsSigner.sendTransactionBatch(transactionBatch);
    await transaction.awaitBatchReceipt();

    // Assert
    expect(await blsProvider.getBalance(recipient)).to.equal(expectedAmount);

    // Nonce is supplied with batch options so spy should not be called
    expect(spy).to.have.been.called.exactly(0);
  });

  it("should throw an error sending & signing a transaction batch when 'transaction.to' has not been defined", async () => {
    // Arrange
    const transactionBatch = new Array(3).fill({
      ...{ value: parseEther("1") },
    });

    // Act
    const sendResult = async () =>
      await blsSigner.sendTransactionBatch({
        transactions: transactionBatch,
      });
    const signResult = async () =>
      await blsSigner.signTransactionBatch({
        transactions: transactionBatch,
      });

    // Assert
    await expect(sendResult()).to.be.rejectedWith(
      TypeError,
      "Transaction.to is missing on transaction 0",
    );
    await expect(signResult()).to.be.rejectedWith(
      TypeError,
      "Transaction.to is missing on transaction 0",
    );
  });

  it("should throw an error when sending an invalid transaction batch", async () => {
    // Arrange
    const invalidTransactionBatch = new Array(3).fill({
      ...{
        to: ethers.Wallet.createRandom().address,
        value: parseEther("-1"),
      },
    });

    // Act
    const result = async () =>
      await blsSigner.sendTransactionBatch({
        transactions: invalidTransactionBatch,
      });

    // Assert
    await expect(result()).to.be.rejectedWith(
      Error,
      'value out-of-bounds (argument="ethValue", value="-1000000000000000000", code=INVALID_ARGUMENT, version=abi/5.7.0)',
    );
  });

  it("should return a transaction batch response when sending a transaction batch", async () => {
    // Arrange
    const expectedAmount = parseEther("1");
    const recipients = [];
    const transactionBatch = [];
    const expectedNonce = await BlsWalletWrapper.Nonce(
      blsSigner.wallet.PublicKey(),
      blsSigner.verificationGatewayAddress,
      blsProvider,
    );

    for (let i = 0; i < 3; i++) {
      recipients.push(ethers.Wallet.createRandom().address);
      transactionBatch.push({
        to: recipients[i],
        value: expectedAmount,
      });
    }

    // Act
    const transactionBatchResponse = await blsSigner.sendTransactionBatch({
      transactions: transactionBatch,
    });

    // Assert
    // tx 1
    expect(transactionBatchResponse.transactions[0])
      .to.be.an("object")
      .that.includes({
        hash: transactionBatchResponse.transactions[0].hash,
        to: recipients[0],
        from: blsSigner.wallet.address,
        data: "0x",
        chainId: 1337,
        type: 2,
        confirmations: 1,
      });
    expect(transactionBatchResponse.transactions[0].nonce).to.equal(
      expectedNonce,
    );
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
        to: recipients[1],
        from: blsSigner.wallet.address,
        data: "0x",
        chainId: 1337,
        type: 2,
        confirmations: 1,
      });
    expect(transactionBatchResponse.transactions[1].nonce).to.equal(
      expectedNonce,
    );
    expect(transactionBatchResponse.transactions[1].gasLimit).to.equal(
      BigNumber.from("0x0"),
    );
    expect(transactionBatchResponse.transactions[1].value).to.equal(
      BigNumber.from(expectedAmount),
    );

    // tx 3
    expect(transactionBatchResponse.transactions[2])
      .to.be.an("object")
      .that.includes({
        hash: transactionBatchResponse.transactions[2].hash,
        to: recipients[2],
        from: blsSigner.wallet.address,
        data: "0x",
        chainId: 1337,
        type: 2,
        confirmations: 1,
      });
    expect(transactionBatchResponse.transactions[2].nonce).to.equal(
      expectedNonce,
    );
    expect(transactionBatchResponse.transactions[2].gasLimit).to.equal(
      BigNumber.from("0x0"),
    );
    expect(transactionBatchResponse.transactions[2].value).to.equal(
      BigNumber.from(expectedAmount),
    );
  });

  it("should validate batch options", async () => {
    // Arrange
    const batchOptions = {
      gas: ethers.utils.parseUnits("40000"),
      maxPriorityFeePerGas: ethers.utils.parseUnits("0.5", "gwei"),
      maxFeePerGas: ethers.utils.parseUnits("23", "gwei"),
      nonce: 39,
      chainId: 1337,
      accessList: [],
    };

    // Act
    const result = await blsSigner._validateBatchOptions(batchOptions);

    // Assert
    expect(result).to.deep.equal(batchOptions);
    expect(result.nonce).to.equal(BigNumber.from("39"));
    expect(result.nonce).to.have.property("add");
    expect(result.nonce).to.not.be.a("number");
  });

  it("should throw an error when invalid private key is supplied", async () => {
    // Arrange
    const newBlsProvider = new BlsProvider(
      aggregatorUrl,
      verificationGateway,
      aggregatorUtilities,
      rpcUrl,
      network,
    );
    const newBlsSigner = newBlsProvider.getSigner("invalidPrivateKey");

    // Act
    const result = async () =>
      await newBlsSigner.sendTransaction({
        to: ethers.Wallet.createRandom().address,
        value: parseEther("1"),
      });

    // Assert
    await expect(result()).to.be.rejectedWith(
      Error,
      "Expect hex but got invalidPrivateKey",
    );
  });

  it("should throw an error when invalid private key is supplied after a valid getSigner call", async () => {
    // Arrange
    const newBlsSigner = blsProvider.getSigner("invalidPrivateKey");

    // Act
    const result = async () =>
      await newBlsSigner.sendTransaction({
        to: ethers.Wallet.createRandom().address,
        value: parseEther("1"),
      });

    // Assert
    await expect(result()).to.be.rejectedWith(
      Error,
      "Expect hex but got invalidPrivateKey",
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

  it("should sign a transaction to create a bundleDto and serialize the result", async () => {
    // Arrange
    const recipient = ethers.Wallet.createRandom().address;
    const transaction = {
      value: "1000000000000000000",
      to: recipient,
      data: "0x",
      from: await blsSigner.getAddress(),
    };

    // get expected signature
    const expectedAction: ActionData = {
      ethValue: parseEther("1"),
      contractAddress: recipient,
      encodedFunction: "0x",
    };

    const wallet = await BlsWalletWrapper.connect(
      privateKey,
      verificationGateway,
      blsProvider,
    );
    const walletAddress = wallet.address;

    const expectedNonce = await BlsWalletWrapper.Nonce(
      wallet.PublicKey(),
      verificationGateway,
      blsSigner,
    );

    // BlsWalletWrapper.getRandomBlsPrivateKey from "estimateGas" method results in slightly different
    // fee estimates. Which leads to a different signature. This fake avoids signature mismatch by stubbing a constant value.
    sinon.replace(
      BlsWalletWrapper,
      "getRandomBlsPrivateKey",
      sinon.fake.resolves(privateKey),
    );

    const expectedFeeEstimate = await blsProvider.estimateGas(transaction);

    const actionsWithSafeFee = blsProvider._addFeePaymentActionWithSafeFee(
      [expectedAction],
      expectedFeeEstimate,
    );

    const expectedOperation = {
      nonce: expectedNonce,
      gas: BigNumber.from(30_000_000),
      actions: [...actionsWithSafeFee],
    };

    const expectedBundle = wallet.blsWalletSigner.sign(
      expectedOperation,
      walletAddress,
    );

    const expectedBundleSignatureHexStrings = expectedBundle.signature.map(
      (keyElement) => BigNumber.from(keyElement).toHexString(),
    );

    // Act
    const signedTransaction = await blsSigner.signTransaction(transaction);

    // Assert
    const bundleDto = JSON.parse(signedTransaction);
    expect(bundleDto.signature).to.deep.equal(
      expectedBundleSignatureHexStrings,
    );
  });

  it("should throw an error when signing an invalid transaction", async () => {
    // Arrange
    const invalidEthValue = parseEther("-1");

    // Act
    const result = async () =>
      await blsSigner.signTransaction({
        value: invalidEthValue,
        to: ethers.Wallet.createRandom().address,
      });

    // Assert
    await expect(result()).to.be.rejectedWith(
      Error,
      'value out-of-bounds (argument="ethValue", value="-1000000000000000000", code=INVALID_ARGUMENT, version=abi/5.7.0)',
    );
  });

  it("should sign a transaction batch to create a bundleDto and serialize the result", async () => {
    // Arrange
    const expectedAmount = parseEther("1");

    const recipients = [];
    const transactions = [];
    const expectedActions = [];
    for (let i = 0; i < 3; i++) {
      recipients.push(ethers.Wallet.createRandom().address);
      transactions.push({
        to: recipients[i],
        value: expectedAmount,
        data: "0x",
      });
      expectedActions.push({
        contractAddress: recipients[i],
        ethValue: expectedAmount,
        encodedFunction: "0x",
      });
    }

    // get expected signature
    const wallet = await BlsWalletWrapper.connect(
      privateKey,
      verificationGateway,
      blsProvider,
    );

    const expectedNonce = await BlsWalletWrapper.Nonce(
      wallet.PublicKey(),
      verificationGateway,
      blsSigner,
    );

    const actionsWithFeePaymentAction =
      blsProvider._addFeePaymentActionForFeeEstimation(expectedActions);

    const expectedFeeEstimate = await blsProvider.aggregator.estimateFee(
      await blsSigner.wallet.signWithGasEstimate({
        nonce: expectedNonce,
        actions: [...actionsWithFeePaymentAction],
      }),
    );

    const safeFee = addSafetyPremiumToFee(
      BigNumber.from(expectedFeeEstimate.feeRequired),
    );

    const actionsWithSafeFee = blsProvider._addFeePaymentActionWithSafeFee(
      expectedActions,
      safeFee,
    );

    const expectedBundle = await wallet.signWithGasEstimate({
      nonce: expectedNonce,
      actions: [...actionsWithSafeFee],
    });

    // Act
    const signedTransaction = await blsSigner.signTransactionBatch({
      transactions,
    });

    // Assert
    const bundleDto = JSON.parse(signedTransaction);
    expect(bundleDto.signature).to.deep.equal(expectedBundle.signature);
  });

  it("should throw an error when signing an invalid transaction batch", async () => {
    // Arrange
    const invalidEthValue = parseEther("-1");

    const unsignedTransaction = {
      value: invalidEthValue,
      to: ethers.Wallet.createRandom().address,
    };

    // Act
    const result = async () =>
      await blsSigner.signTransactionBatch({
        transactions: [unsignedTransaction],
      });

    // Assert
    await expect(result()).to.be.rejectedWith(
      Error,
      'value out-of-bounds (argument="ethValue", value="-1000000000000000000", code=INVALID_ARGUMENT, version=abi/5.7.0)',
    );
  });

  it("should not retrieve nonce when signing a transaction batch with batch options", async () => {
    // Arrange
    const spy = chai.spy.on(BlsWalletWrapper, "Nonce");

    const transactionBatch = {
      transactions: [
        {
          to: ethers.Wallet.createRandom().address,
          value: parseEther("1"),
        },
      ],
      batchOptions: {
        gas: ethers.utils.parseUnits("40000"),
        maxPriorityFeePerGas: ethers.utils.parseUnits("0.5", "gwei"),
        maxFeePerGas: ethers.utils.parseUnits("23", "gwei"),
        nonce: 0,
        chainId: 1337,
        accessList: [],
      },
    };

    // Act
    await blsSigner.signTransactionBatch(transactionBatch);

    // Assert
    // Nonce is supplied with batch options so spy should not be called
    expect(spy).to.have.been.called.exactly(0);
  });

  it("should check transaction", async () => {
    // Arrange
    const recipient = ethers.Wallet.createRandom().address;
    const transactionAmount = parseEther("1");

    // Act
    const result = blsSigner.checkTransaction({
      to: recipient,
      value: transactionAmount,
    });

    // Assert
    const resolvedResult = await resolveProperties(result);
    expect(resolvedResult).to.be.an("object").that.includes({
      to: recipient,
      value: transactionAmount,
      from: blsSigner.wallet.address,
    });
  });

  // TODO: (merge-ok) This tests a non-overrideen method and seems to pull the nonce from the aggregator instance.
  // So will revisit this and ensure the method is using the correct nonce at a later stage.
  it("should populate transaction", async () => {
    // Arrange
    const recipient = ethers.Wallet.createRandom().address;
    const transactionAmount = parseEther("1");

    // Act
    const result = await blsSigner.populateTransaction({
      to: recipient,
      value: transactionAmount,
    });

    // Assert
    expect(result).to.be.an("object").that.includes({
      to: recipient,
      value: transactionAmount,
      from: blsSigner.wallet.address,
      type: 2,
      chainId: 1337,
    });

    expect(result).to.include.keys(
      "maxFeePerGas",
      "maxPriorityFeePerGas",
      "gasLimit",
      "nonce",
    );
  });

  it("should sign message of type string", async () => {
    // Arrange
    const address = ethers.Wallet.createRandom().address;
    const expectedSignedMessage = blsSigner.wallet.signMessage(address);

    // Act
    const signedMessage = await blsSigner.signMessage(address);
    const formattedSignedMessage =
      BlsSigner.signedMessageToSignature(signedMessage);

    // Assert
    expect(formattedSignedMessage).to.deep.equal(expectedSignedMessage);
  });

  it("should sign message of type bytes", async () => {
    // Arrange
    const bytes: number[] = [68, 219, 115, 219, 26, 248, 170, 165]; // random bytes
    const hexString = ethers.utils.hexlify(bytes);
    const expectedSignature = blsSigner.wallet.signMessage(hexString);

    // Act
    const signedMessage = await blsSigner.signMessage(bytes);
    const formattedSignedMessage =
      BlsSigner.signedMessageToSignature(signedMessage);

    // Assert
    expect(formattedSignedMessage).to.deep.equal(expectedSignature);
  });

  it("should await the init promise when connecting to an unchecked bls signer", async () => {
    // Arrange
    const newPrivateKey = await BlsSigner.getRandomBlsPrivateKey();
    const newBlsSigner = blsProvider.getSigner(newPrivateKey);
    const uncheckedBlsSigner = newBlsSigner.connectUnchecked();

    await fundedWallet.sendTransaction({
      to: await uncheckedBlsSigner.getAddress(),
      value: parseEther("1.1"),
    });

    const recipient = ethers.Wallet.createRandom().address;
    const transactionAmount = parseEther("1");
    const balanceBefore = await blsProvider.getBalance(recipient);

    // Act
    const uncheckedResponse = await uncheckedBlsSigner.sendTransaction({
      value: transactionAmount,
      to: recipient,
    });
    await uncheckedResponse.wait();

    // Assert
    expect(
      (await blsProvider.getBalance(recipient)).sub(balanceBefore),
    ).to.equal(transactionAmount);
  });

  it("should get the transaction receipt when using a new provider and connecting to an unchecked bls signer", async () => {
    // Arrange & Act
    const newBlsProvider = new BlsProvider(
      aggregatorUrl,
      verificationGateway,
      aggregatorUtilities,
      rpcUrl,
      network,
    );
    const newPrivateKey = await BlsSigner.getRandomBlsPrivateKey();
    const newBlsSigner = newBlsProvider.getSigner(newPrivateKey);
    const uncheckedBlsSigner = newBlsSigner.connectUnchecked();

    await fundedWallet.sendTransaction({
      to: await uncheckedBlsSigner.getAddress(),
      value: parseEther("1.1"),
    });

    const recipient = ethers.Wallet.createRandom().address;
    const transactionAmount = parseEther("1");
    const balanceBefore = await blsProvider.getBalance(recipient);

    // Act
    const uncheckedResponse = await uncheckedBlsSigner.sendTransaction({
      value: transactionAmount,
      to: recipient,
    });
    await uncheckedResponse.wait();

    // Assert
    expect(
      (await blsProvider.getBalance(recipient)).sub(balanceBefore),
    ).to.equal(transactionAmount);
  });

  it("should send ETH (empty call) via an unchecked transaction", async () => {
    // Arrange
    const recipient = ethers.Wallet.createRandom().address;
    const transactionAmount = parseEther("1");
    const balanceBefore = await blsProvider.getBalance(recipient);

    // Act
    const uncheckedTransactionHash = await blsSigner.sendUncheckedTransaction({
      value: transactionAmount,
      to: recipient,
    });
    await blsProvider.getTransactionReceipt(uncheckedTransactionHash);

    // Assert
    expect(
      (await blsProvider.getBalance(recipient)).sub(balanceBefore),
    ).to.equal(transactionAmount);
  });

  it("should send ETH (empty call) using an unchecked bls signer", async () => {
    // Arrange
    const uncheckedBlsSigner = blsSigner.connectUnchecked();

    const recipient = ethers.Wallet.createRandom().address;
    const transactionAmount = parseEther("1");
    const balanceBefore = await blsProvider.getBalance(recipient);

    // Act
    const uncheckedResponse = await uncheckedBlsSigner.sendTransaction({
      value: transactionAmount,
      to: recipient,
    });
    await uncheckedResponse.wait();

    // Assert
    expect(uncheckedResponse).to.be.an("object").that.includes({
      hash: uncheckedResponse.hash,
      data: "",
      chainId: 0,
      confirmations: 0,
      from: "",
    });

    expect(uncheckedResponse.gasLimit).to.equal(BigNumber.from("0"));
    expect(uncheckedResponse.gasPrice).to.equal(BigNumber.from("0"));
    expect(uncheckedResponse.value).to.equal(BigNumber.from("0"));
    expect(isNaN(uncheckedResponse.nonce)).to.be.true;

    expect(
      (await blsProvider.getBalance(recipient)).sub(balanceBefore),
    ).to.equal(transactionAmount);
  });

  it("should get the balance of an account at specific block height", async () => {
    // Arrange
    const expectedBalance = parseEther("0");

    // Act
    const result = await blsSigner.getBalance("earliest");

    // Assert
    expect(result).to.equal(expectedBalance);
  });

  it("should get the chain id the wallet is connected to", async () => {
    // Arrange
    const { chainId: expectedChainId } = await regularProvider.getNetwork();

    // Act
    const result = await blsSigner.getChainId();

    // Assert
    expect(result).to.equal(expectedChainId);
  });

  it("should get the current gas price", async () => {
    // Arrange
    const expectedGasPrice = await regularProvider.getGasPrice();

    // Act
    const result = await blsSigner.getGasPrice();

    // Assert
    expect(result).to.equal(expectedGasPrice);
  });

  it("should get the number of transactions the account has sent", async () => {
    // Arrange
    const expectedTransactionCount = await blsSigner.wallet.Nonce();

    // Act
    const transactionCount = await blsSigner.getTransactionCount();

    // Assert
    expect(transactionCount).to.equal(expectedTransactionCount);
  });

  it("should get the number of transactions the account has sent at the specified block tag", async () => {
    // Arrange
    const expectedTransactionCount = 0;

    const sendTransaction = await blsSigner.sendTransaction({
      value: parseEther("1"),
      to: ethers.Wallet.createRandom().address,
    });
    await sendTransaction.wait();

    // Act
    const transactionCount = await blsSigner.getTransactionCount("earliest");

    // Assert
    expect(transactionCount).to.equal(expectedTransactionCount);
  });

  it("should return the result of call using the transactionRequest, with the signer account address being used as the from field", async () => {
    // Arrange
    const spy = chai.spy.on(BlsProvider.prototype, "call");

    const testERC20 = MockERC20Factory.connect(
      networkConfig.addresses.testToken,
      blsProvider,
    );

    // Act
    const result = await blsSigner.call({
      to: testERC20.address,
      data: testERC20.interface.encodeFunctionData("totalSupply"),
      // Explicitly omit 'from'
    });

    // Assert
    expect(formatEther(result)).to.equal("1000000.0");
    expect(spy).to.have.been.called.once;
    expect(spy).to.have.been.called.with({
      to: testERC20.address,
      data: testERC20.interface.encodeFunctionData("totalSupply"),
      from: blsSigner.wallet.address, // Assert that 'from' has been added to the provider call
    });
  });

  it("should estimate gas without throwing an error, with the signer account address being used as the from field.", async () => {
    // Arrange
    const spy = chai.spy.on(BlsProvider.prototype, "estimateGas");
    const recipient = ethers.Wallet.createRandom().address;

    // Act
    const gasEstimate = async () =>
      await blsSigner.estimateGas({
        to: recipient,
        value: parseEther("1"),
        // Explicitly omit 'from'
      });

    // Assert
    await expect(gasEstimate()).to.not.be.rejected;
    expect(spy).to.have.been.called.once;
    expect(spy).to.have.been.called.with({
      to: recipient,
      value: parseEther("1"),
      from: blsSigner.wallet.address, // Assert that 'from' has been added to the provider call
    });
  });

  // ENS is not supported by hardhat so we are checking the correct error behaviour in this scenario
  it("should throw an error when passing in a correct ENS name", async () => {
    // Arrange
    const ensName = "vitalik.eth";

    // Act
    const result = async () => await blsSigner.resolveName(ensName);

    // Assert
    await expect(result()).to.be.rejectedWith(
      Error,
      "network does not support ENS",
    );
  });

  it("should throw an error when trying to unlock an account with http access", async () => {
    // Arrange
    const madeUpPassword = "password";

    // Act
    const unlock = async () => await blsSigner.unlock(madeUpPassword);

    // Assert
    await expect(unlock()).to.be.rejectedWith(
      Error,
      "account unlock with HTTP access is forbidden",
    );
  });

  it("should validate a transaction request", async () => {
    // Arrange
    const recipient = ethers.Wallet.createRandom().address;
    const getBalancePromise = blsSigner.getBalance();
    const expectedValidatedTransaction = {
      to: recipient,
      value: await blsSigner.getBalance(),
      from: await blsSigner.getAddress(),
    };

    // Act
    const validatedTransaction = await blsSigner._validateTransaction({
      to: recipient,
      value: getBalancePromise,
    });

    // Assert
    expect(validatedTransaction).to.deep.equal(expectedValidatedTransaction);
  });

  it("should throw an error validating a transaction request when transaction.to is not defined", async () => {
    // Arrange & Act
    const result = async () =>
      await blsSigner._validateTransaction({
        value: await blsSigner.getBalance(),
      });

    // Assert
    await expect(result()).to.be.rejectedWith(
      TypeError,
      "Transaction.to should be defined",
    );
  });

  it("should validate a transaction batch", async () => {
    // Arrange
    const recipient = ethers.Wallet.createRandom().address;
    const amount = await blsSigner.getBalance();
    const expectedValidatedTransactionBatch = {
      transactions: [
        {
          to: recipient,
          value: amount,
          from: await blsSigner.getAddress(),
        },
      ],
      batchOptions: undefined,
    };

    // Act
    const validatedTransaction = await blsSigner._validateTransactionBatch({
      transactions: [
        {
          to: recipient,
          value: amount,
        },
      ],
    });

    // Assert
    expect(validatedTransaction).to.deep.equal(
      expectedValidatedTransactionBatch,
    );
  });

  it("should throw an error validating a transaction batch when transaction.to is not defined", async () => {
    // Arrange & Act
    const result = async () =>
      await blsSigner._validateTransactionBatch({
        transactions: [
          {
            value: await blsSigner.getBalance(),
          },
        ],
      });

    // Assert
    await expect(result()).to.be.rejectedWith(
      TypeError,
      "Transaction.to is missing on transaction 0",
    );
  });
});
