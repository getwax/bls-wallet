#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write --unstable

import { delay, ethers } from "../deps/index.ts";

import * as env from "../test/env.ts";
import Client from "../src/app/Client.ts";
import AdminWallet from "../src/chain/AdminWallet.ts";
import BlsWallet from "../src/chain/BlsWallet.ts";
import MockErc20 from "../test/helpers/MockErc20.ts";
import TestBlsWallets from "./helpers/TestBlsWallets.ts";

const logStartTime = Date.now();

const RelativeTimestamp = () => (
  Math.floor((Date.now() - logStartTime) / 1000)
    .toString()
    .padStart(4, "0")
);

function log(...args: unknown[]) {
  console.log(RelativeTimestamp(), ...args);
}

const leadTarget = env.MAX_AGGREGATION_SIZE * env.MAX_UNCONFIRMED_AGGREGATIONS;
const pollingInterval = 400;
const sendWalletCount = 50;

const provider = new ethers.providers.JsonRpcProvider(env.RPC_URL);
const adminWallet = AdminWallet(provider);

const testErc20 = new MockErc20(env.TEST_TOKEN_ADDRESS, provider);

const client = new Client(`http://localhost:${env.PORT}`);

log("Connecting/creating test wallets...");

const [recvWallet, ...sendWallets] = await TestBlsWallets(
  provider,
  sendWalletCount + 1,
);

log("Checking/minting test tokens...");

for (const wallet of sendWallets) {
  const testErc20 = new MockErc20(
    env.TEST_TOKEN_ADDRESS,
    adminWallet,
  );

  if (
    (await testErc20.balanceOf(wallet.address)).lt(
      ethers.BigNumber.from(10).pow(17),
    )
  ) {
    log("Minting test token for wallet", wallet.address);
    await testErc20.mint(wallet.address, ethers.BigNumber.from(10).pow(18));
  }
}

const startBalance = await testErc20.balanceOf(recvWallet.address);

log("Getting nonces...");

const nextNonceMap = new Map<BlsWallet, number>(
  await Promise.all(sendWallets.map(async (sendWallet) => {
    const nextNonce = await sendWallet.Nonce();

    return [sendWallet, nextNonce] as const;
  })),
);

log("Begin throughput test");

let txsSent = 0;
let txsAdded = 0;
let txsCompleted = 0;
let sendWalletIndex = 0;

pollingLoop(() => {
  // Send transactions

  const lead = txsSent - txsCompleted;
  const leadDeficit = leadTarget - lead;

  for (let i = 0; i < leadDeficit; i++) {
    sendWalletIndex = (sendWalletIndex + 1) % sendWalletCount;
    const sendWallet = sendWallets[sendWalletIndex];
    const nonce = nextNonceMap.get(sendWallet)!;
    nextNonceMap.set(sendWallet, nonce + 1);

    const tx = sendWallet.buildTx({
      contract: testErc20.contract,
      method: "transfer",
      args: [recvWallet.address, "1"],
      nonce,
    });

    client.addTransaction(tx).then(() => {
      txsAdded++;
    });

    txsSent++;
  }
});

const startTime = Date.now();

pollingLoop(async () => {
  // Calculate and show stats

  const balance = await testErc20.balanceOf(recvWallet.address);
  txsCompleted = balance.sub(startBalance).toNumber();

  console.clear();

  const txsPerSec = 1000 * txsCompleted / (Date.now() - startTime);

  console.log({
    txsSent,
    txsAdded,
    txsCompleted,
    txsPerSec: txsPerSec.toFixed(1),
  });
});

async function pollingLoop(body: () => unknown) {
  while (true) {
    await body();
    await delay(pollingInterval);
  }
}
