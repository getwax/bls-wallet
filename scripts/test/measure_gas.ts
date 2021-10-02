import { BigNumber } from "ethers";
import blsKeyHash from "../../shared/helpers/blsKeyHash";
import dataPayload from "../../shared/helpers/dataPayload";
import getDeployedAddresses, { DeployedAddresses } from "../../shared/helpers/getDeployedAddresses";
import Fixture from "../../shared/helpers/Fixture";
import TokenHelper from "../../shared/helpers/TokenHelper";

import { aggregate } from "../../shared/lib/hubble-bls/src/signer";
import { ethers, network } from "hardhat";
import { exit } from "process";

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
    let blsWalletAddresses = await th.walletTokenSetup();

    // encode transfer to consecutive addresses of 1*10^-18 of a token
    // signed by first bls wallet
    let signatures: any[] = new Array(transferCount);
    let encodedFunctions: any[] = new Array(transferCount);
    let startNonce: number = (await fx.BLSWallet.attach(blsWalletAddresses[0]).nonce() as BigNumber).toNumber();
    let nonce = startNonce;
    console.log("airdropper balance before", await th.testToken.balanceOf(blsWalletAddresses[0]));

    let AddressZero = "0x"+"0".repeat(40);

    console.log("Signing txs from nonce", nonce);
    for (let i = 0; i<transferCount; i++) {
      encodedFunctions[i] = th.testToken.interface.encodeFunctionData(
        "transfer",
        ["0x"+(i+1).toString(16).padStart(40, '0'), i]
      );
  
      let dataToSign = dataPayload(
        fx.chainId,
        nonce++,
        AddressZero,
        BigNumber.from(0),
        BigNumber.from(0),
        th.testToken.address,
        encodedFunctions[i]
      );

      signatures[i] = fx.blsSigners[0].sign(dataToSign);
    }

    let aggSignature = aggregate(signatures);
    console.log("Done signing & aggregating.");

    let methodId = encodedFunctions[0].substring(0,10);
    let encodedParamSets = encodedFunctions.map( a => '0x'+a.substr(10) );
    try {
      console.log("Estimating...", fx.blsExpander.address);
      let gasEstimate = await fx.blsExpander.estimateGas.blsCallMultiSameCallerContractFunction(
        blsKeyHash(fx.blsSigners[0]),
        startNonce,
        aggSignature,
        AddressZero,
        Array(signatures.length).fill(0),
        th.testToken.address,
        methodId,
        encodedParamSets
      )

      console.log("Sending...");
      gasResults.estimate = gasEstimate.toNumber();
      let response = await fx.blsExpander.blsCallMultiSameCallerContractFunction(
        blsKeyHash(fx.blsSigners[0]),
        startNonce,
        aggSignature,
        AddressZero,
        Array(signatures.length).fill(0),
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
  