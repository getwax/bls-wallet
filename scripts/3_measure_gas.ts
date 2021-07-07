import { BigNumber, Signer, Contract } from "ethers";
import { readFile, readFileSync } from "fs";


import Fixture from "../shared/helpers/Fixture";
import TokenHelper from "../shared/helpers/TokenHelper";

import { aggregate } from "../shared/lib/hubble-bls/src/signer";

let fx: Fixture;
let th: TokenHelper;

async function optimisedTransferEstimate() {
  
}

async function main() {
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

    let dataToSign = fx.dataPayload(
      0,
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
  