#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

import { ethers } from "../deps.ts";
import * as env from "../src/env.ts";
import getRawTransaction from "../src/helpers/getRawTransaction.ts";

const provider = new ethers.providers.JsonRpcProvider(env.RPC_URL);

const txHash = Deno.args[0];

if (!txHash.startsWith("0x")) {
  throw new Error("First arg should be tx hash");
}

console.log(await getRawTransaction(provider, txHash));
