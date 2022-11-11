import { expect } from "chai";
import { ethers } from "hardhat";
import { JsonRpcProvider, JsonRpcSigner } from "@ethersproject/providers";
import { parseEther, formatEther } from "ethers/lib/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Wallet } from "ethers";

import BlsProvider from "../clients/src/BlsProvider";
import BlsSigner from "../clients/src/BlsSigner";

describe.only("BlsSigner tests", () => {
  let rpcUrl: string;
  let aggregatorUrl: string;
  let blsProvider: BlsProvider;
  let blsSigner: BlsSigner;
  let regularProvider: JsonRpcProvider;
  let regularSigner: JsonRpcSigner;
  let signers: SignerWithAddress[];

  beforeEach(async () => {
    signers = await ethers.getSigners();
    aggregatorUrl = "http://localhost:3000";
    rpcUrl = "http://localhost:8545";
    const network = {
      name: "localhost",
      chainId: 0x7a69,
    };

    // FIXME: Unsure on how to manage the private key!
    const privateKey = Wallet.createRandom().privateKey;
    const verificationGateway = "0x3C17E9cF70B774bCf32C66C8aB83D19661Fc27E2";

    blsProvider = new BlsProvider(aggregatorUrl, rpcUrl, network);
    blsSigner = blsProvider.getSigner();
    await blsSigner.initWallet(privateKey, verificationGateway, blsProvider);

    regularProvider = new JsonRpcProvider("http://localhost:8545");
    regularSigner = regularProvider.getSigner();
  });

  // 1. Create BlsWallet
  // 2. Send ETH to BlsWallet
  // 3. Connect to BlsWallet via provider/signer
  // 4. Send a transaction using the connected provider/signer

  // Backends like Metamask, Geth, Parity (and many more) have an RPC interface that
  // allows an external application to interact with them using the "eth_signTransaction" RPC method,
  // while not giving access to private keys to the application.

  // The application has to prepare an unsigned transaction object and send it to the provider.
  // And in response, the provider returns back the signature, which the application can then broadcast
  // to the network (some providers can also broadcast the transaction).

  // If you just pass in any random eth address in the JsonRpcSigner whose private key is not with
  // the provider, the provider will return an error.

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
    const recipientBalanceAfter = await blsProvider.getBalance(recipient);
    console.log(
      "recipientBalanceAfter: ",
      formatEther(recipientBalanceAfter.toString()),
    );
    console.log("expectedBalance: ", formatEther(expectedBalance.toString()));
    expect(recipientBalanceAfter.sub(recipientBalanceBefore)).to.equal(
      expectedBalance,
    );
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
});
