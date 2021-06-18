import { BigNumber, Signer, Contract } from "ethers";
import { readFile, readFileSync } from "fs";


import Fixture from "../shared/helpers/Fixture";
import TokenHelper from "../shared/helpers/TokenHelper";

import { aggregate } from "../shared/lib/hubble-bls/src/signer";

let fx: Fixture;
let th: TokenHelper;

async function main() {
    fx = await Fixture.create();
    th = new TokenHelper(fx);

    let blsWalletAddresses = await th.walletTokenSetup();

    // encode transfer of start amount to first wallet
    let encodedFunction = th.testToken.interface.encodeFunctionData(
      "transfer",
      [blsWalletAddresses[0], TokenHelper.userStartAmount.toString()]
    );

    let signatures: any[] = new Array(blsWalletAddresses.length);
    for (let i = 0; i<blsWalletAddresses.length; i++) {
      let dataToSign = fx.dataPayload(
        await fx.BLSWallet.attach(blsWalletAddresses[i]).nonce(),
        BigNumber.from(0),
        th.testToken.address,
        encodedFunction
      );
      signatures[i] = fx.blsSigners[i].sign(dataToSign);
    }

    // each bls wallet to sign same transfer data
    // let signatures = blsSigners.map(b => b.sign(dataToSign));
    let aggSignature = aggregate(signatures);

    // can be called by any ecdsa wallet
    let gasEstimate = await fx.blsExpander.estimateGas.blsCallMultiSameContractFunctionParams(
        fx.blsSigners.map(Fixture.blsKeyHash),
        aggSignature,
        Array(signatures.length).fill(0),
        th.testToken.address,
        encodedFunction.substring(0,10),
        '0x'+encodedFunction.substr(10)
    );
    console.log(gasEstimate.toNumber());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
  