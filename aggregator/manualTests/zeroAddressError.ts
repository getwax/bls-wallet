#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write --unstable

import { ethers, MockERC20__factory } from "../deps.ts";

import EthereumService from "../src/app/EthereumService.ts";
import * as env from "../test/env.ts";
import TestBlsWallets from "./helpers/TestBlsWallets.ts";
import getNetworkConfig from "../src/helpers/getNetworkConfig.ts";

const { addresses } = await getNetworkConfig();

const provider = new ethers.providers.JsonRpcProvider(env.RPC_URL);
const ethereumService = await EthereumService.create(
  (evt) => {
    console.log(evt);
  },
  addresses.verificationGateway,
  addresses.utilities,
  env.PRIVATE_KEY_AGG,
);

const testErc20 = MockERC20__factory.connect(addresses.testToken, provider);
const [wallet] = await TestBlsWallets(provider, 1);

const bundle = wallet.sign({
  nonce: await wallet.Nonce(),
  actions: [{
      ethValue: 0,
      contractAddress: testErc20.address,
      encodedFunction: testErc20.interface.encodeFunctionData(
        "transferFrom",
        [
          "0x0000000000000000000000000000000000000000",
          wallet.address,
          ethers.BigNumber.from("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),
        ],
      ),
    }],
});

console.log("Sending via ethereumService");

(async () => {
  try {
    const r: any = await ethereumService.submitBundle(bundle);

    // no args if no error
    const result = r.events[0].args.results[0]; // For errors this is "Error(string)"
    const errorArgBytesString: string = "0x" + result.substring(10); // remove methodId (4bytes after 0x)
    const errorString = ethers.utils.defaultAbiCoder.decode(
      ["string"],
      errorArgBytesString,
    )[0]; // decoded bytes is a string of the action index that errored.
    console.log('Revert error: ', errorString)
  } catch (error) {
    console.error(error.stack);
    Deno.exit(1);
  }
})();
