#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write --unstable

import { AggregatorClient, ethers } from "../deps.ts";
import AdminWallet from "../src/chain/AdminWallet.ts";

import * as env from "../test/env.ts";
import TestBlsWallets from "./helpers/TestBlsWallets.ts";

const provider = new ethers.providers.JsonRpcProvider(env.RPC_URL);

const client = new AggregatorClient(env.ORIGIN);

const [wallet] = await TestBlsWallets(provider, 1);

const adminWallet = AdminWallet(provider);

await (await adminWallet.sendTransaction({
  to: wallet.address,
  value: 1,
})).wait();

const bundle = wallet.sign({
  nonce: await wallet.Nonce(),
  actions: [{
    ethValue: 1,
    contractAddress: adminWallet.address,
    encodedFunction: "0x",
  }],
});

const feeEstimation = await client.estimateFee(bundle);

console.log({ feeEstimation });
