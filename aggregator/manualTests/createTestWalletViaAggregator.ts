#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write --unstable

import {
  AggregatorClient,
  BlsWalletWrapper,
  ethers,
  parseArgs,
} from "../deps.ts";

import assert from "../src/helpers/assert.ts";
import getNetworkConfig from "../src/helpers/getNetworkConfig.ts";
import nil from "../src/helpers/nil.ts";
import Rng from "../src/helpers/Rng.ts";
import * as env from "../test/env.ts";

const provider = new ethers.providers.JsonRpcProvider(env.RPC_URL);

const _client = new AggregatorClient(env.ORIGIN);

const rng = Rng.root.seed("test-wallet");

const { seed } = parseArgs(Deno.args);

if (!seed) {
  console.error(
    "Usage: ./manualTests/createTestWalletViaAggregator.ts --seed <seed>",
  );

  Deno.exit(1);
}

const privateKey = rng.seed(`${seed}`).address();

const { addresses } = await getNetworkConfig();

const wallet = await BlsWalletWrapper.connect(
  privateKey,
  addresses.verificationGateway,
  provider,
);

if (wallet !== nil) {
  console.log(`Already exists, address: ${wallet.address}`);
  Deno.exit(0);
}

console.log("Sending creation tx to aggregator");

// TODO (merge-ok) Fix when wallet creation added.
// const createResult = await client.createWallet(bun);
const createResult = {
  address: "0x123456",
  failures: [{
    description: "createTestWalletViaAggregator: createWallet not implemented",
  }],
};

assert(
  createResult.failures.length === 0,
  createResult.failures.map((f) => f.description).join(", "),
);

console.log(`Created, address: ${createResult.address}`);
