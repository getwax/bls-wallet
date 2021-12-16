#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write --unstable

import { AggregatorClient, delay, ethers } from "../deps.ts";

import assert from "../src/helpers/assert.ts";
import getNetworkConfig from "../src/helpers/getNetworkConfig.ts";
import * as env from "../test/env.ts";
import MockErc20 from "../test/helpers/MockErc20.ts";
import TestBlsWallets from "./helpers/TestBlsWallets.ts";

const { addresses } = await getNetworkConfig();

const provider = new ethers.providers.JsonRpcProvider(env.RPC_URL);

const testErc20 = new MockErc20(addresses.testToken, provider);

const client = new AggregatorClient(env.ORIGIN);

const [wallet] = await TestBlsWallets(provider, 1);

const startBalance = await testErc20.balanceOf(wallet.address);

const tx = wallet.sign({
  contract: testErc20.contract,
  method: "mint",
  args: [wallet.address, "1"],
  nonce: await wallet.Nonce(),
});

console.log("Sending mint tx to aggregator");

const failures = await client.addTransaction(tx);
assert(failures.length === 0, failures.map((f) => f.description).join(", "));

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
