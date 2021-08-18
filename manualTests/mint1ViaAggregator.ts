#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write --unstable

import { delay, ethers } from "../deps/index.ts";

import Client from "../src/app/Client.ts";
import assert from "../src/helpers/assert.ts";
import * as env from "../test/env.ts";
import MockErc20 from "../test/helpers/MockErc20.ts";
import TestBlsWallets from "./helpers/TestBlsWallets.ts";

const provider = new ethers.providers.JsonRpcProvider(env.RPC_URL);

const testErc20 = new MockErc20(env.TEST_TOKEN_ADDRESS, provider);

const client = new Client(env.ORIGIN);

const [wallet] = await TestBlsWallets(provider, 1);

const startBalance = await testErc20.balanceOf(wallet.address);

let nextNonce = await wallet.Nonce();

const tx = wallet.buildTx({
  contract: testErc20.contract,
  method: "mint",
  args: [wallet.address, "1"],
  nonce: nextNonce++,
});

console.log("Sending mint tx to aggregator");

const failures = await client.addTransaction(tx);
assert(failures.length === 0);

console.log("Success response from aggregator");

while (true) {
  const balance = (await testErc20.balanceOf(wallet.address));

  console.log({
    startBalance: startBalance.toString(),
    balance: balance.toString(),
  });

  if (!balance.eq(startBalance)) {
    console.log("done");
    break;
  }

  console.log("Balance has not increased, waiting 500ms");
  await delay(500);
}
