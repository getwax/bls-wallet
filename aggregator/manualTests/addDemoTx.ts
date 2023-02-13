#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write

import { AggregatorClient } from "../deps.ts";
import * as env from "../src/env.ts";
import Fixture from "../test/helpers/Fixture.ts";

const client = new AggregatorClient(env.ORIGIN);

const fx = await Fixture.create(import.meta.url);
const [wallet] = await fx.setupWallets(1);

const bundle = wallet.sign({
  nonce: await wallet.Nonce(),
  actions: [{
    ethValue: 0,
    contractAddress: fx.testErc20.address,
    encodedFunction: fx.testErc20.interface.encodeFunctionData(
      "mint",
      [wallet.address, 20],
    ),
  }],
});

console.log("sending", bundle);

const res = await client.add(bundle);
if ("failures" in res) {
  throw new Error(res.failures.join(", "));
}
