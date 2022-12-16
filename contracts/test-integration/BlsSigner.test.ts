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
} from "../clients/src";
import getNetworkConfig from "../shared/helpers/getNetworkConfig";
import { UncheckedBlsSigner } from "../clients/src/BlsSigner";

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

    // random private key
    privateKey =
      "0xfef2e4f3849e4e6f1e0737620ab1e1656cec24692a4627fe52f93758e377869e";

    regularProvider = new ethers.providers.JsonRpcProvider(rpcUrl);

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

  it("should return a transaction response when sending a transaction", async () => {
    // Arrange
    const recipient = signers[1].address;
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
      chainId: 31337,
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
      rpcUrl,
      network,
    );
    const newBlsSigner = newBlsProvider.getSigner("invalidPrivateKey");

    // Act
    const result = async () =>
      await newBlsSigner.sendTransaction({
        to: signers[1].address,
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
        to: signers[1].address,
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
    const recipient = signers[1].address;
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
    const signedTransaction = await blsSigner.signTransaction(transaction);

    // Assert
    const bundleDto = JSON.parse(signedTransaction);
    expect(bundleDto.signature).to.deep.equal(expectedBundle.signature);
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
    const resolvedResult = await resolveProperties(result);
    expect(resolvedResult).to.be.an("object").that.includes({
      to: recipient,
      value: transactionAmount,
      from: blsSigner.wallet.address,
    });
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
    expect(result).to.be.an("object").that.includes({
      to: recipient,
      value: transactionAmount,
      from: blsSigner.wallet.address,
      type: 2,
      nonce: 1,
      chainId: 31337,
    });

    expect(result).to.include.keys(
      "maxFeePerGas",
      "maxPriorityFeePerGas",
      "gasLimit",
    );
  });

  it("should sign message of type string", async () => {
    // Arrange
    const address = signers[1].address;
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

  it("should connect to an unchecked bls signer", () => {
    // Arrange & Act
    const uncheckedBlsSigner = blsSigner.connectUnchecked();

    // Assert
    expect(uncheckedBlsSigner._isSigner).to.be.true;
    expect(uncheckedBlsSigner).to.be.instanceOf(UncheckedBlsSigner);
  });

  it("should await the init promise when connecting to an unchecked bls signer", async () => {
    // Arrange & Act
    // random private key
    const newPrivateKey =
      "0x35b5fe04e9c24433f0489e241c2678f429f226a4b8da520695631bb7af12d4f9";
    const newBlsSigner = blsProvider.getSigner(newPrivateKey);
    const uncheckedBlsSigner = newBlsSigner.connectUnchecked();

    const recipient = signers[1].address;
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
      rpcUrl,
      network,
    );
    // random private key
    const newPrivateKey =
      "0x35b5fe04e9c24433f0489e241c2678f429f226a4b8da520695631bb7af12d4f9";
    const newBlsSigner = newBlsProvider.getSigner(newPrivateKey);
    const uncheckedBlsSigner = newBlsSigner.connectUnchecked();

    const recipient = signers[1].address;
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
    const recipient = signers[1].address;
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

    const recipient = signers[1].address;
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
    const expectedTransactionCount = await regularProvider.getTransactionCount(
      blsSigner.wallet.address,
    );

    // Act
    const result = await blsSigner.getTransactionCount();

    // Assert
    expect(result).to.equal(expectedTransactionCount);
  });

  it("should get the number of transactions the account has sent at the specified block tag", async () => {
    // Arrange
    const expectedTransactionCount = 0;

    // Act
    const result = await blsSigner.getTransactionCount("earliest");

    // Assert
    expect(result).to.equal(expectedTransactionCount);
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

  // TODO: bls-wallet #410 estimate gas for a transaction
  it("should estimate gas without throwing an error, with the signer account address being used as the from field.", async () => {
    // Arrange
    const spy = chai.spy.on(Experimental.BlsProvider.prototype, "estimateGas");

    const transaction = {
      to: signers[1].address,
      value: parseEther("1"),
      // Explicitly omit 'from'
    };

    // Act
    const gasEstimate = async () => await blsSigner.estimateGas(transaction);

    // Assert
    await expect(gasEstimate()).to.not.be.rejected;
    expect(spy).to.have.been.called.once;
    expect(spy).to.have.been.called.with({
      to: signers[1].address,
      value: parseEther("1"),
      from: blsSigner.wallet.address, // Assert that 'from' has been added to the provider call
    });
  });

  it("should throw an error when ENS name is not a string", async () => {
    // Arrange
    const ensName = null;

    // Act
    const result = async () => await blsSigner.resolveName(ensName);

    // Assert
    await expect(result()).to.be.rejectedWith(Error, "invalid ENS name");
  });

  it("should throw an error when ENS name fails formatting checks", async () => {
    // Arrange
    const ensName = ethers.utils.formatBytes32String("invalid");

    // Act
    const result = async () => await blsSigner.resolveName(ensName);

    // Assert
    await expect(result()).to.be.rejectedWith(Error, "invalid address");
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
    const resolvedResult = await resolveProperties(result);
    expect(resolvedResult)
      .to.be.an("object")
      .that.includes({
        to: recipient,
        value: transactionAmount,
        from: await regularSigner.getAddress(),
      });
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
    expect(result).to.be.an("object").that.includes({
      to: recipient,
      value: transactionAmount,
      from: signers[0].address,
      type: 2,
      chainId: 31337,
    });

    expect(result).to.include.keys(
      "maxFeePerGas",
      "maxPriorityFeePerGas",
      "nonce",
      "gasLimit",
    );
  });
});
