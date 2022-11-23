import { ethers } from "hardhat";
import { expect } from "chai";
import { Wallet } from "@ethersproject/wallet";
import { JsonRpcProvider, JsonRpcSigner } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Networkish } from "@ethersproject/networks";
import { parseEther } from "ethers/lib/utils";
import { BigNumber } from "@ethersproject/bignumber";

import { BlsProvider, BlsSigner, ActionDataDto, BlsWalletWrapper } from "../clients/src";

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

describe.only("BlsSigner", () => {
  beforeEach(async () => {
    signers = await ethers.getSigners();
    aggregatorUrl = "http://localhost:3000";
    verificationGateway = "0x689A095B4507Bfa302eef8551F90fB322B3451c6";
    rpcUrl = "http://localhost:8545";
    network = {
      name: "localhost",
      chainId: 0x7a69,
    };
    // FIXME: Unsure on how to manage the private key! Leave it up to dapps/wallets?
    privateKey = Wallet.createRandom().privateKey;

    regularProvider = new JsonRpcProvider(rpcUrl);

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

  it("should join failures and throw an error when sending an invalid transaction", async () => {
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
      "field operations: element 0: field actions: element 0: field ethValue: hex string: missing 0x prefix\\nfield operations: element 0: field actions: element 0: field ethValue: hex string: incorrect byte length: 8.5",
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
    const uninitialisedBlsSigner = newBlsProvider.getSigner();

    // Act
    const result = async () =>
      await uninitialisedBlsSigner.sendTransaction({
        to: signers[2].address,
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
    const action: ActionDataDto = {
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
        to: "",
        value: parseEther("1"),
      });

    // Assert
    await expect(result()).to.be.rejectedWith(
      Error,
      "signTransaction() is not implemented, call 'signBlsTransaction()' instead",
    );
  });
});

describe.only("JsonRpcSigner", () => {
  beforeEach(() => {
    rpcUrl = "http://localhost:8545";
    regularProvider = new JsonRpcProvider(rpcUrl);
    regularSigner = regularProvider.getSigner();
  });

  it("should retrieve the account address", async () => {
    // Arrange
    const expectedAddress = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";

    // Act
    const address = await regularSigner.getAddress();

    // Assert
    expect(address.toLowerCase()).to.equal(expectedAddress);
  });

  it("should send ETH (empty call) successfully", async () => {
    // Arrange
    const recipient = signers[2].address;
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
});
