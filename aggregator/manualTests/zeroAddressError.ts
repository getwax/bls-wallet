#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write

import { AggregatorClient, ethers, MockERC20Factory } from "../deps.ts";

// import EthereumService from "../src/app/EthereumService.ts";
import * as env from "../test/env.ts";
import TestBlsWallet from "./helpers/TestBlsWallet.ts";
import getNetworkConfig from "../src/helpers/getNetworkConfig.ts";

const { addresses } = await getNetworkConfig();
const client = new AggregatorClient(env.ORIGIN);

const provider = new ethers.providers.JsonRpcProvider(env.RPC_URL);
// const ethereumService = await EthereumService.create(
//   (evt) => {
//     console.log(evt);
//   },
//   env.PRIVATE_KEY_AGG,
// );

const testErc20 = MockERC20Factory.connect(addresses.testToken, provider);
const wallet = await TestBlsWallet(provider);

const bundle = await wallet.signWithGasEstimate({
  nonce: await wallet.Nonce(),
  actions: [{
    ethValue: 0,
    contractAddress: testErc20.address,
    encodedFunction: testErc20.interface.encodeFunctionData(
      "transferFrom",
      [
        "0x0000000000000000000000000000000000000000",
        wallet.address,
        ethers.BigNumber.from(
          "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        ),
      ],
    ),
  }],
});

console.log("Sending via ethereumService or agg");

(async () => {
  try {
    // Test directly with ethereum service
    // await ethereumService.submitBundle(bundle);

    // test by submitting request to the agg
    const res = await client.add(bundle);
    console.log(res);
  } catch (error) {
    console.error(error.stack);
    Deno.exit(1);
  }
})();
