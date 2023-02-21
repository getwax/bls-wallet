/* eslint-disable camelcase */
import { ethers as hardhatEthers } from "hardhat";
import chai, { expect } from "chai";
import { ethers, BigNumber } from "ethers";
import {
  parseEther,
  resolveProperties,
  RLP,
  formatEther,
} from "ethers/lib/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  Experimental,
  ActionData,
  BlsWalletWrapper,
  NetworkConfig,
  // eslint-disable-next-line camelcase
  MockERC20__factory,
  AggregatorUtilities__factory,
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
      "Transaction.to should be defined",
    );
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
      'invalid BigNumber value (argument="value", value=undefined, code=INVALID_ARGUMENT, version=bignumber/5.7.0)',
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

  it("should throw an error when invalid private key is supplied", async () => {
    // Arrange
    const newBlsProvider = new Experimental.BlsProvider(
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

  it("should not throw an error when invalid private key is supplied after a valid getSigner call", async () => {
    // Arrange
    const newBlsSigner = blsProvider.getSigner("invalidPrivateKey");

    // Act
    const result = async () =>
      await newBlsSigner.sendTransaction({
        to: ethers.Wallet.createRandom().address,
        value: parseEther("1"),
      });

    // Assert
    await expect(result()).to.not.be.rejectedWith(Error);
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

  it("should throw an error signing a transaction when transaction.to has not been defined", async () => {
    // Arrange
    const transaction = {
      value: parseEther("1"),
    };

    // Act
    const result = async () => await blsSigner.sendTransaction(transaction);

    // Assert
    await expect(result()).to.be.rejectedWith(
      TypeError,
      "Transaction.to should be defined",
    );
  });

  it("should sign a transaction to create a bundleDto and serialize the result", async () => {
    // Arrange
    const recipient = ethers.Wallet.createRandom().address;
    const transaction = {
      value: "1000000000000000000",
      to: recipient,
      data: "0x",
    };
    const action: ActionData = {
      ethValue: parseEther("1"),
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

    const feeEstimate = await blsProvider.estimateGas(transaction);

    const aggregatorUtilitiesContract = AggregatorUtilities__factory.connect(
      blsProvider.aggregatorUtilitiesAddress,
      blsProvider,
    );

    const operation = {
      nonce,
      actions: [
        action,
        {
          ethValue: feeEstimate,
          contractAddress: blsProvider.aggregatorUtilitiesAddress,
          encodedFunction:
            aggregatorUtilitiesContract.interface.encodeFunctionData(
              "sendEthToTxOrigin",
            ),
        },
      ],
    };

    const expectedBundle = wallet.blsWalletSigner.sign(
      operation,
      privateKey,
      walletAddress,
    );

    // Act
    const signedTransaction = await blsSigner.signTransaction(transaction);

    // Assert
    const bundleDto = JSON.parse(signedTransaction);
    expect(bundleDto.signature).to.deep.equal(expectedBundle.signature);
  });

  it("should throw an error when signing an invalid transaction", async () => {
    // Arrange
    const invalidEthValue = parseEther("-1");

    const unsignedTransaction = {
      value: invalidEthValue,
      to: ethers.Wallet.createRandom().address,
    };

    // Act
    const result = async () =>
      await blsSigner.signTransaction(unsignedTransaction);

    // Assert
    await expect(result()).to.be.rejectedWith(
      Error,
      'invalid BigNumber value (argument="value", value=undefined, code=INVALID_ARGUMENT, version=bignumber/5.7.0)',
    );
  });

  it("should check transaction", async () => {
    // Arrange
    const recipient = ethers.Wallet.createRandom().address;
    const transactionAmount = parseEther("1");
    const transaction = {
      to: recipient,
      value: transactionAmount,
    };

    // Act
    const result = blsSigner.checkTransaction(transaction);

    // Assert
    const resolvedResult = await resolveProperties(result);
    expect(resolvedResult).to.be.an("object").that.includes({
      to: recipient,
      value: transactionAmount,
      from: blsSigner.wallet.address,
    });
  });

  // TODO: This tests a non-overrideen method and seems to pull the nonce from the aggregator instance.
  // So will revisit this and ensure the method is using the correct nonce at a later stage.
  it("should populate transaction", async () => {
    // Arrange
    const recipient = ethers.Wallet.createRandom().address;
    const transactionAmount = parseEther("1");
    const transaction = {
      to: recipient,
      value: transactionAmount,
    };

    // Act
    const result = await blsSigner.populateTransaction(transaction);

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
    const blsWalletSignerSignature =
      blsSigner.wallet.blsWalletSigner.signMessage(
        address,
        blsSigner.wallet.privateKey,
      );

    const expectedSignature = RLP.encode(blsWalletSignerSignature);

    // Act
    const signedMessage = await blsSigner.signMessage(address);

    // Assert
    expect(signedMessage).to.deep.equal(expectedSignature);
    expect(RLP.decode(signedMessage)).to.deep.equal(blsWalletSignerSignature);
  });

  it("should sign message of type bytes", async () => {
    // Arrange
    const bytes: number[] = [68, 219, 115, 219, 26, 248, 170, 165]; // random bytes
    const hexString = ethers.utils.hexlify(bytes);
    const blsWalletSignerSignature =
      blsSigner.wallet.blsWalletSigner.signMessage(
        hexString,
        blsSigner.wallet.privateKey,
      );

    const expectedSignature = RLP.encode(blsWalletSignerSignature);

    // Act
    const signedMessage = await blsSigner.signMessage(bytes);

    // Assert
    expect(signedMessage).to.deep.equal(expectedSignature);
    expect(RLP.decode(signedMessage)).to.deep.equal(blsWalletSignerSignature);
  });

  it("should await the init promise when connecting to an unchecked bls signer", async () => {
    // Arrange & Act
    const newPrivateKey = await BlsWalletWrapper.getRandomBlsPrivateKey();
    const newBlsSigner = blsProvider.getSigner(newPrivateKey);
    const uncheckedBlsSigner = newBlsSigner.connectUnchecked();

    const recipient = ethers.Wallet.createRandom().address;
    const transactionAmount = parseEther("1");
    const transaction = {
      value: transactionAmount,
      to: recipient,
    };
    const balanceBefore = await blsProvider.getBalance(recipient);

    // Act
    const uncheckedResponse = await uncheckedBlsSigner.sendTransaction(
      transaction,
    );
    await uncheckedResponse.wait();

    // Assert
    expect(
      (await blsProvider.getBalance(recipient)).sub(balanceBefore),
    ).to.equal(transactionAmount);
  });

  // TODO (merge-ok) https://github.com/web3well/bls-wallet/issues/427
  // This test is identical to the above test except this one uses a new instance of a provider, yet fails to find the tx receipt
  it.skip("should get the transaction receipt when using a new provider and connecting to an unchecked bls signer", async () => {
    // Arrange & Act
    const newBlsProvider = new Experimental.BlsProvider(
      aggregatorUrl,
      verificationGateway,
      aggregatorUtilities,
      rpcUrl,
      network,
    );
    const newPrivateKey = await BlsWalletWrapper.getRandomBlsPrivateKey();
    const newBlsSigner = newBlsProvider.getSigner(newPrivateKey);
    const uncheckedBlsSigner = newBlsSigner.connectUnchecked();

    const recipient = ethers.Wallet.createRandom().address;
    const transactionAmount = parseEther("1");
    const transaction = {
      value: transactionAmount,
      to: recipient,
    };
    const balanceBefore = await blsProvider.getBalance(recipient);

    // Act
    const uncheckedResponse = await uncheckedBlsSigner.sendTransaction(
      transaction,
    );
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
    const transaction = {
      value: transactionAmount,
      to: recipient,
    };
    const balanceBefore = await blsProvider.getBalance(recipient);

    // Act
    const uncheckedTransactionHash = await blsSigner.sendUncheckedTransaction(
      transaction,
    );
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
    const transaction = {
      value: transactionAmount,
      to: recipient,
    };
    const balanceBefore = await blsProvider.getBalance(recipient);

    // Act
    const uncheckedResponse = await uncheckedBlsSigner.sendTransaction(
      transaction,
    );
    await uncheckedResponse.wait();

    // Assert
    expect(uncheckedResponse).to.be.an("object").that.includes({
      hash: uncheckedResponse.hash,
      nonce: 1,
      data: "",
      chainId: 0,
      confirmations: 0,
      from: "",
    });

    expect(uncheckedResponse.gasLimit).to.equal(BigNumber.from("0"));
    expect(uncheckedResponse.gasPrice).to.equal(BigNumber.from("0"));
    expect(uncheckedResponse.value).to.equal(BigNumber.from("0"));

    expect(
      (await blsProvider.getBalance(recipient)).sub(balanceBefore),
    ).to.equal(transactionAmount);
  });

  it("should get the balance of an account", async () => {
    // Arrange
    const expectedBalance = await regularProvider.getBalance(
      blsSigner.wallet.address,
    );

    // Act
    const result = await blsSigner.getBalance();

    // Assert
    expect(result).to.equal(expectedBalance);
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
      value: BigNumber.from(1),
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
    const spy = chai.spy.on(Experimental.BlsProvider.prototype, "call");

    // eslint-disable-next-line camelcase
    const testERC20 = MockERC20__factory.connect(
      networkConfig.addresses.testToken,
      blsProvider,
    );

    const transaction = {
      to: testERC20.address,
      data: testERC20.interface.encodeFunctionData("totalSupply"),
      // Explicitly omit 'from'
    };

    // Act
    const result = await blsSigner.call(transaction);

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
    const spy = chai.spy.on(Experimental.BlsProvider.prototype, "estimateGas");
    const recipient = ethers.Wallet.createRandom().address;
    const transaction = {
      to: recipient,
      value: parseEther("1"),
      // Explicitly omit 'from'
    };

    // Act
    const gasEstimate = async () => await blsSigner.estimateGas(transaction);

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
});

describe("JsonRpcSigner", () => {
  let signers: SignerWithAddress[];
  let wallet: ethers.Wallet;

  beforeEach(async () => {
    signers = await hardhatEthers.getSigners();
    rpcUrl = "http://localhost:8545";
    regularProvider = new ethers.providers.JsonRpcProvider(rpcUrl);
    // First two Hardhat account private keys are used in aggregator .env. We choose to use Hardhat account #2 private key here to avoid nonce too low errors.
    wallet = new ethers.Wallet(
      "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // Hardhat account #2 private key
      regularProvider,
    );
  });

  it("should retrieve the account address", async () => {
    // Arrange
    const expectedAddress = signers[2].address;

    // Act
    const address = await wallet.getAddress();

    // Assert
    expect(address).to.equal(expectedAddress);
  });

  it("should send ETH (empty call) successfully", async () => {
    // Arrange
    const recipient = ethers.Wallet.createRandom().address;
    const expectedBalance = parseEther("1");
    const recipientBalanceBefore = await regularProvider.getBalance(recipient);

    // Act
    const transaction = await wallet.sendTransaction({
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
    const recipient = ethers.Wallet.createRandom().address;
    const transactionAmount = parseEther("1");
    const transaction = {
      to: recipient,
      value: transactionAmount,
    };

    // Act
    const result = wallet.checkTransaction(transaction);

    // Assert
    const resolvedResult = await resolveProperties(result);
    expect(resolvedResult)
      .to.be.an("object")
      .that.includes({
        to: recipient,
        value: transactionAmount,
        from: await wallet.getAddress(),
      });
  });

  it("should populate transaction", async () => {
    // Arrange
    const recipient = ethers.Wallet.createRandom().address;
    const transactionAmount = parseEther("1");
    const transaction = {
      to: recipient,
      value: transactionAmount,
    };

    // Act
    const result = await wallet.populateTransaction(transaction);

    // Assert
    expect(result).to.be.an("object").that.includes({
      to: recipient,
      value: transactionAmount,
      from: signers[2].address,
      type: 2,
      chainId: 1337,
    });

    expect(result).to.include.keys(
      "maxFeePerGas",
      "maxPriorityFeePerGas",
      "nonce",
      "gasLimit",
    );
  });
});
