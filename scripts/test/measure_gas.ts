import { BigNumber } from "ethers";
import blsKeyHash from "../../shared/helpers/blsKeyHash";
import dataPayload from "../../shared/helpers/dataPayload";
import getDeployedAddresses, { DeployedAddresses } from "../../shared/helpers/getDeployedAddresses";
import Fixture from "../../shared/helpers/Fixture";
import TokenHelper from "../../shared/helpers/TokenHelper";

import { aggregate } from "../../shared/lib/hubble-bls/src/signer";

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
  
    fx = await Fixture.create(1);
    th = new TokenHelper(fx);

    let blsWalletAddresses = await th.walletTokenSetup();

    // encode transfer to consecutive addresses of 1*10^-18 of a token
    // signed by first bls wallet
    let signatures: any[] = new Array(transferCount);
    let encodedFunctions: any[] = new Array(transferCount);
    let nonce = await fx.BLSWallet.attach(blsWalletAddresses[0]).nonce()
    for (let i = 0; i<transferCount; i++) {
      encodedFunctions[i] = th.testToken.interface.encodeFunctionData(
        "transfer",
        ["0x"+(i+1).toString(16).padStart(40, '0'), 1]
      );
  
      let dataToSign = dataPayload(
        fx.chainId,
        nonce++,
        BigNumber.from(0),
        BigNumber.from(0),
        th.testToken.address,
        encodedFunctions[i]
      );

      signatures[i] = fx.blsSigners[0].sign(dataToSign);
    }

    let aggSignature = aggregate(signatures);

    let methodId = encodedFunctions[0].substring(0,10);
    let encodedParamSets = encodedFunctions.map( a => '0x'+a.substr(10) );
    try {
      let gasEstimate = await fx.blsExpander.estimateGas.blsCallMultiSameCallerContractFunction(
        blsKeyHash(fx.blsSigners[0]),
        aggSignature,
        Array(signatures.length).fill(0),
        th.testToken.address,
        methodId,
        encodedParamSets
      )

      gasResults.estimate = gasEstimate.toNumber();
      let response = await fx.blsExpander.blsCallMultiSameCallerContractFunction(
        blsKeyHash(fx.blsSigners[0]),
        aggSignature,
        Array(signatures.length).fill(0),
        th.testToken.address,
        methodId,
        encodedParamSets
      );
      gasResults.limit = (response.gasLimit as BigNumber).toNumber();
      let receipt = await response.wait();
      gasResults.used = (receipt.gasUsed as BigNumber).toNumber();
      gasResults.txHash = receipt.transactionHash;
    }
    catch(e) {
      console.log("err");
    }
    console.log(gasResults);
  }
}

async function logGasForCreateMany() {
  let walletCounts = [2,5,6,7];
  console.log("Creating wallets for: ", walletCounts);
  for (let i=0; i<walletCounts.length; i++) {
    let walletCount = walletCounts[i];
    let gasResults = {
      walletCount: walletCount,
      estimate: -1,
      limit: -1,
      used: -1
    }
  
    fx = await Fixture.create(walletCount);

    let dataToSign = dataPayload(
      fx.chainId,
      0,
      BigNumber.from(0),
      BigNumber.from(0),
      fx.verificationGateway.address,
      fx.encodedCreate
    );

    let signatures: any[] = new Array(fx.blsSigners.length);
    for (let i = 0; i<fx.blsSigners.length; i++) {
      signatures[i] = fx.blsSigners[i].sign(dataToSign);
    }
    let aggSignature = aggregate(signatures);
    let pubKeys = fx.blsSigners.map( s => s.pubkey );
    try {
      let gasEstimate = await fx.verificationGateway.estimateGas.blsCreateMany(
        Array(signatures.length).fill(0),
        pubKeys,
        aggSignature
      );
      gasResults.estimate = gasEstimate.toNumber();

      let response = await fx.verificationGateway.blsCreateMany(
        Array(signatures.length).fill(0),
        fx.blsSigners.map( s => s.pubkey ),
        aggSignature
      );
      gasResults.limit = (response.gasLimit as BigNumber).toNumber();
      let receipt = await response.wait();
      gasResults.used = (receipt.gasUsed as BigNumber).toNumber();
    }
    catch(e) {
      console.log("err");
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
  