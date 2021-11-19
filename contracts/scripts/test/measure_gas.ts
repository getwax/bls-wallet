import { BigNumber } from "ethers";
import { Transaction } from "../../clients/src";
import getDeployedAddresses from "../../shared/helpers/getDeployedAddresses";
import Fixture from "../../shared/helpers/Fixture";
import TokenHelper from "../../shared/helpers/TokenHelper";

import { network } from "hardhat";

let fx: Fixture;
let th: TokenHelper;

async function main() {
  await logGasForTransfers();
  console.log();
  // await logGasForCreateMany();
}

async function logGasForTransfers() {
  let transferCounts = [29, 30, 31];
  console.log("Batch transfers for: ", transferCounts);
  for (let i=0; i<transferCounts.length; i++) {
    let transferCount = transferCounts[i];
    let gasResults = {
      transferCount: transferCount,
      estimate: -1,
      limit: -1,
      used: -1,
      txHash: -1
    }
  
    let config = getDeployedAddresses(network.name);

    fx = await Fixture.create(
      1,
      false,
      config.blsLibAddress,
      config.vgAddress,
      config.expanderAddress,
      [+process.env.BLS_SECRET_NUM_1]
    );
    th = new TokenHelper(fx);
    let blsWallets = await th.walletTokenSetup();

    // encode transfer to consecutive addresses of 1*10^-18 of a token
    // signed by first bls wallet
    let txs: Transaction[] = [];
    let startNonce: number = (await blsWallets[0].Nonce()).toNumber();
    let nonce = startNonce;
    console.log("airdropper balance before", await th.testToken.balanceOf(blsWallets[0].address));

    let AddressZero = "0x"+"0".repeat(40);

    console.log("Signing txs from nonce", nonce);
    for (let i = 0; i<transferCount; i++) {
      const tx = blsWallets[i].sign({
        nonce: BigNumber.from(nonce++),
        actions: [
          {
            contract: th.testToken,
            method: "transfer",
            args: ["0x"+(i+1).toString(16).padStart(40, '0'), BigNumber.from(i).toHexString()],
          },
        ],
      });

      txs.push(tx);
    }

    const aggTx = fx.blsWalletSigner.aggregate(txs);
    console.log("Done signing & aggregating.");

    const methodId = txs[0].subTransactions[0].actions[0].encodedFunction.slice(0, 10);
    const encodedParamSets = txs.map(tx =>
      `0x${tx.subTransactions[0].actions[0].encodedFunction.slice(10)}`
    );
    try {
      const publicKeyHash = fx.blsWalletSigner.getPublicKeyHash(blsWallets[0].privateKey);

      console.log("Estimating...", fx.blsExpander.address);
      let gasEstimate = await fx.blsExpander.estimateGas.blsCallMultiSameCallerContractFunction(
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
      let response = await fx.blsExpander.blsCallMultiSameCallerContractFunction(
        publicKeyHash,
        startNonce,
        aggTx.signature,
        AddressZero,
        Array(txs.length).fill(0),
        th.testToken.address,
        methodId,
        encodedParamSets
      );
      gasResults.limit = (response.gasLimit as BigNumber).toNumber();
      console.log("waiting");
      let receipt = await response.wait();
      gasResults.used = (receipt.gasUsed as BigNumber).toNumber();
      gasResults.txHash = receipt.transactionHash;
      console.log("Done\n");
    }
    catch(e) {
      console.log("err", e);
    }
    console.log(gasResults);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
  