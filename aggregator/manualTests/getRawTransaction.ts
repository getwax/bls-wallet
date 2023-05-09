#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

import { pick } from "npm:@s-libs/micro-dash";

import { ethers } from "../deps.ts";
import * as env from "../src/env.ts";

const provider = new ethers.providers.JsonRpcProvider(env.RPC_URL);

const txHash = Deno.args[0];

if (!txHash.startsWith("0x")) {
  throw new Error("First arg should be tx hash");
}

const txResponse = await provider.getTransaction(txHash);

const txBytes = ethers.utils.serializeTransaction(
  pick(
    txResponse,
    "to",
    "nonce",
    "gasLimit",
    ...(txResponse.type === 2 ? [] : ["gasPrice"] as const),
    "data",
    "value",
    "chainId",
    "type",
    ...(txResponse.type !== 2 ? [] : [
      "accessList",
      "maxPriorityFeePerGas",
      "maxFeePerGas",
    ] as const),
  ),
  pick(
    txResponse,
    "v",
    "r",
    "s",
  ) as { v: number; r: string; s: string },
);

const reconstructedHash = ethers.utils.keccak256(txBytes);

if (reconstructedHash !== txHash) {
  throw new Error("Reconstructed hash did not match original hash");
}

console.log(txBytes);
