/* eslint-disable no-process-exit */

import { BigNumber } from "ethers";
import { Bundle } from "../../clients/src";
import getDeployedAddresses from "../../shared/helpers/getDeployedAddresses";
import Fixture from "../../shared/helpers/Fixture";
import TokenHelper from "../../shared/helpers/TokenHelper";

import { network } from "hardhat";
import { solidityPack } from "ethers/lib/utils";

let fx: Fixture;
let th: TokenHelper;

async function main() {
  await logGasForTransfers();
  console.log();
  // await logGasForCreateMany();
}

async function logGasForTransfers() {
  const transferCounts = [29, 30, 31];
  console.log("Batch transfers for: ", transferCounts);
  for (let i = 0; i < transferCounts.length; i++) {
    const transferCount = transferCounts[i];
    const gasResults = {
      transferCount: transferCount,
      estimate: -1,
      limit: -1,
      used: -1,
      txHash: -1,
    };

    const config = getDeployedAddresses(network.name);

    fx = await Fixture.create(
      1,
      false,
      config.blsLibAddress,
      config.vgAddress,
      config.expanderAddress,
      [+process.env.BLS_SECRET_NUM_1],
    );
    th = new TokenHelper(fx);
    const blsWallets = await th.walletTokenSetup();

    // encode transfer to consecutive addresses of 1*10^-18 of a token
    // signed by first bls wallet
    const txs: Bundle[] = [];
    const startNonce: number = (await blsWallets[0].Nonce()).toNumber();
    let nonce = startNonce;
    console.log(
      "airdropper balance before",
      await th.testToken.balanceOf(blsWallets[0].address),
    );

    const AddressZero = "0x" + "0".repeat(40);

    console.log("Signing txs from nonce", nonce);
    for (let i = 0; i < transferCount; i++) {
      const tx = blsWallets[i].sign({
        nonce: BigNumber.from(nonce++),
        actions: [
          {
            ethValue: BigNumber.from(0),
            contractAddress: th.testToken.address,
            encodedFunction: th.testToken.interface.encodeFunctionData(
              "transfer",
              [
                "0x" + (i + 1).toString(16).padStart(40, "0"),
                BigNumber.from(i).toHexString(),
              ],
            ),
          },
        ],
      });

      txs.push(tx);
    }

    const aggTx = fx.blsWalletSigner.aggregate(txs);
    console.log("Done signing & aggregating.");

    const encodedFunction = solidityPack(
      ["bytes"],
      [txs[0].operations[0].actions[0].encodedFunction],
    );

    const methodId = encodedFunction.slice(0, 10);

    const encodedParamSets = txs.map((tx) => `0x${encodedFunction.slice(10)}`);
    try {
      const publicKeyHash = fx.blsWalletSigner.getPublicKeyHash(
        blsWallets[0].privateKey,
      );

      console.log("Estimating...", fx.blsExpander.address);
      const gasEstimate =
        await fx.blsExpander.estimateGas.blsCallMultiSameCallerContractFunction(
          publicKeyHash,
          startNonce,
          aggTx.signature,
          AddressZero,
          Array(txs.length).fill(0),
          th.testToken.address,
          methodId,
          encodedParamSets,
        );

      console.log("Sending...");
      gasResults.estimate = gasEstimate.toNumber();
      const response =
        await fx.blsExpander.blsCallMultiSameCallerContractFunction(
          publicKeyHash,
          startNonce,
          aggTx.signature,
          AddressZero,
          Array(txs.length).fill(0),
          th.testToken.address,
          methodId,
          encodedParamSets,
        );
      gasResults.limit = (response.gasLimit as BigNumber).toNumber();
      console.log("waiting");
      const receipt = await response.wait();
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
