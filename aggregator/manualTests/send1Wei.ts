#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

import { ethers } from "../deps.ts";
import * as env from "../src/env.ts";
import AdminWallet from "../src/chain/AdminWallet.ts";

const provider = new ethers.providers.JsonRpcProvider(env.RPC_URL);

const adminWallet = AdminWallet(provider);
const to = ethers.constants.AddressZero;

console.log("sending 1 wei");
console.log(`${adminWallet.address} -> ${to}`);

const txn = await adminWallet.sendTransaction({
  value: "0x01",
  to,
});

console.log(`txn hash ${txn.hash}`);
console.log("waiting ...");

await txn.wait();

console.log("done");
