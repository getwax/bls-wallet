#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write --unstable

import { AggregatorClient } from "../deps.ts";
import * as env from "../src/env.ts";
import Fixture from "../test/helpers/Fixture.ts";

const client = new AggregatorClient(env.ORIGIN);

const fx = await Fixture.create(import.meta.url);
const [wallet] = await fx.setupWallets(1);

const tx = wallet.sign({
  contract: fx.testErc20.contract,
  method: "mint",
  args: [wallet.address, "20"],
  nonce: await wallet.Nonce(),
});

console.log("sending", tx);

const failures = await client.addTransaction(tx);

console.log({ failures });
