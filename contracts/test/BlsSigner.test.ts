import { expect } from "chai";
import { ethers } from "hardhat";
import { JsonRpcProvider, JsonRpcSigner } from "@ethersproject/providers";
import { parseEther, formatEther } from "ethers/lib/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Wallet } from "ethers";
import { Networkish } from "@ethersproject/networks";

import BlsProvider from "../clients/src/BlsProvider";
import BlsSigner from "../clients/src/BlsSigner";
import { ActionDataDto, BlsWalletWrapper, Bundle } from "../clients/src";

describe("BlsSigner tests", () => {
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
    // FIXME: Unsure on how to manage the private key! Leave it up to dapps/wallets?
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

  it("BlsSigner - 'sendTransaction' sends a transaction successfully", async () => {
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

  it("JsonRpcSigner - 'sendTransaction' sends a transaction successfully", async () => {
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

  it("BlsSigner - 'initWallet' not called throws an error", async () => {
    // Arrange
    const newBlsProvider = new BlsProvider(
      aggregatorUrl,
      verificationGateway,
      rpcUrl,
      network,
    );
    const uninitialisedBlsSigner = newBlsProvider.getSigner();

    // Act & Assert
    await expect(
      uninitialisedBlsSigner.sendTransaction({
        to: signers[2].address,
        value: parseEther("1"),
      }),
    ).to.be.rejectedWith(
      Error,
      "To perform this operation, ensure you have instantiated a BlsSigner and have called this.init() to initialize the wallet.",
    );
  });

  it("BlsSigner - 'getAddress' gets the account address successfully", async () => {
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

  it("JsonRpcSigner - 'getAddress' gets the account address successfully", async () => {
    // Arrange
    const expectedAddress = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";

    // Act
    const address = await regularSigner.getAddress();

    // Assert
    expect(address.toLowerCase()).to.equal(expectedAddress);
  });

  it("BlsSigner - 'signBlsTransaction' should sign transaction correctly", async () => {
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

  it("BlsSigner - 'signTransaction' should throw an error", async () => {
    // Arrange, Act & Assert
    await expect(
      blsSigner.signTransaction({
        to: "",
        value: parseEther("1"),
      }),
    ).to.be.rejectedWith(
      Error,
      "signTransaction is not supported, use 'signBlsTransaction(action: ActionDataDto): Promise<Bundle>' instead",
    );
  });
});
