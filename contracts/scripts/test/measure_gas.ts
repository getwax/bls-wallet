/* eslint-disable no-process-exit */
import { BigNumber } from "ethers";
import { solidityPack } from "ethers/lib/utils";
import Fixture from "../../shared/helpers/Fixture";
import TokenHelper from "../../shared/helpers/TokenHelper";
import { processGasResultsToFile } from "../util/arbitrum_gas_util";
import { network } from "hardhat";

let fx: Fixture;
let th: TokenHelper;

async function main() {
  await logGasForTransfers();
  console.log();
  // await logGasForCreateMany();
}

async function logGasForTransfers() {
  const transferCounts = [31];
  console.log("Batch transfers for: ", transferCounts);
  for (let i = 0; i < transferCounts.length; i++) {
    const transferCount = transferCounts[i];
    const gasResults = {
      transferCount,
      estimate: -1,
      limit: -1,
      used: -1,
      txHash: -1,
    };

    fx = await Fixture.create();

    th = new TokenHelper(fx, 1);
    const blsWallets = await th.walletTokenSetup();

    const nonce: number = (await blsWallets[0].Nonce()).toNumber();
    console.log(
      "airdropper balance before",
      await th.testToken.balanceOf(blsWallets[0].address),
    );

    console.log("Signing txs from nonce", nonce);

    const actionsArr = [];
    const encodedFunctions = [];
    const testAddress = "0x" + (1).toString(16).padStart(40, "0");
    const testAmount = BigNumber.from(1).toHexString();
    for (let i = 0; i < transferCount; i++) {
      encodedFunctions.push(
        th.testToken.interface.encodeFunctionData("transfer", [
          testAddress,
          testAmount,
        ]),
      );

      actionsArr.push({
        ethValue: BigNumber.from(0),
        contractAddress: th.testToken.address,
        encodedFunction: encodedFunctions[i],
      });
    }

    const operation = {
      nonce: BigNumber.from(nonce),
      actions: actionsArr,
    };
    const tx = blsWallets[0].sign(operation);

    const aggTx = fx.blsWalletSigner.aggregate([tx]);
    console.log("Done signing & aggregating.");

    const encodedFunction = solidityPack(
      ["bytes"],
      [tx.operations[0].actions[0].encodedFunction],
    );

    const methodId = encodedFunction.slice(0, 10);
    const encodedParamSets = encodedFunctions.map(
      (encFunction) => `0x${encFunction.slice(10)}`,
    );

    try {
      const publicKey = fx.blsWalletSigner.getPublicKey(
        blsWallets[0].privateKey,
      );

      console.log("Estimating...", fx.blsExpander.address);
      const gasEstimate =
        await fx.blsExpander.estimateGas.blsCallMultiSameCallerContractFunction(
          publicKey,
          nonce,
          aggTx.signature,
          th.testToken.address,
          methodId,
          encodedParamSets,
        );

      console.log("Sending Agg Tx...");
      gasResults.estimate = gasEstimate.toNumber();
      const response =
        await fx.blsExpander.blsCallMultiSameCallerContractFunction(
          publicKey,
          nonce,
          aggTx.signature,
          th.testToken.address,
          methodId,
          encodedParamSets,
        );
      gasResults.limit = (response.gasLimit as BigNumber).toNumber();
      console.log("Waiting");
      const receipt = await response.wait();

      // Store gas results to file if testing on Arbitrum network
      if (network.name === "arbitrum_testnet") {
        console.log("Sending normal token transfer...");
        const normalResponse = await th.testToken
          .connect(th.fx.signers[0])
          .transfer(testAddress, testAmount);
        const normalTransferReceipt = await normalResponse.wait();

        await processGasResultsToFile(
          receipt.transactionHash,
          normalTransferReceipt.transactionHash,
          transferCount,
        );
      }

      gasResults.used = (receipt.gasUsed as BigNumber).toNumber();
      gasResults.txHash = receipt.transactionHash;
      console.log("Done\n");
    } catch (e) {
      console.log("err", e);
    }
    console.log(gasResults);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
