import { expect } from "chai";
import { ethers } from "hardhat";
import { JsonRpcProvider, JsonRpcSigner } from "@ethersproject/providers";
import { parseEther, formatEther } from "ethers/lib/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

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

    blsProvider = new BlsProvider(aggregatorUrl, rpcUrl, network);
    blsSigner = blsProvider.getSigner();

    regularProvider = new JsonRpcProvider("http://localhost:8545");
    regularSigner = regularProvider.getSigner();
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
