#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

import { ethers } from "../deps.ts";
import * as env from "../src/env.ts";
import getOptimismL1Fee from "../src/helpers/getOptimismL1Fee.ts";

const provider = new ethers.providers.JsonRpcProvider(env.RPC_URL);

const txHash = Deno.args[0];

if (!txHash.startsWith("0x")) {
  throw new Error("First arg should be tx hash");
}

const l1Fee = await getOptimismL1Fee(provider, txHash);

console.log(`${ethers.utils.formatEther(l1Fee)} ETH`);
