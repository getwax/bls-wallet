#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write --unstable

import { AggregatorClient, BlsWallet, ethers, parseArgs } from "../deps.ts";

import assert from "../src/helpers/assert.ts";
import nil from "../src/helpers/nil.ts";
import Rng from "../src/helpers/Rng.ts";
import * as env from "../test/env.ts";

const provider = new ethers.providers.JsonRpcProvider(env.RPC_URL);

const client = new AggregatorClient(env.ORIGIN);

const rng = Rng.root.seed("test-wallet");

const { seed } = parseArgs(Deno.args);

if (!seed) {
  console.error(
    "Usage: ./manualTests/createTestWalletViaAggregator.ts --seed <seed>",
  );

  Deno.exit(1);
}

const privateKey = rng.seed(`${seed}`).address();

const wallet = await BlsWallet.connect(
  privateKey,
  env.VERIFICATION_GATEWAY_ADDRESS,
  provider,
);

if (wallet !== nil) {
  console.log(`Already exists, address: ${wallet.address}`);
  Deno.exit(0);
}

const tx = await BlsWallet.signCreation(
  privateKey,
  env.VERIFICATION_GATEWAY_ADDRESS,
  provider,
);

console.log("Sending creation tx to aggregator");

const createResult = await client.createWallet(tx);

assert(
  createResult.failures.length === 0,
  createResult.failures.map((f) => f.description).join(", "),
);

console.log(`Created, address: ${createResult.address}`);
