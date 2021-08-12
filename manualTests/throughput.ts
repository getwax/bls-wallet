import { delay, ethers } from "../deps/index.ts";

import Client from "../src/app/Client.ts";
import BlsWallet from "../src/chain/BlsWallet.ts";
import * as env from "../test/env.ts";
import MockErc20 from "../test/helpers/MockErc20.ts";
import createTestWalletsCached from "./helpers/createTestWalletsCached.ts";

const leadTarget = 48;
const pollingInterval = 400;
const sendWalletCount = 50;

const provider = new ethers.providers.JsonRpcProvider(env.RPC_URL);

const testErc20 = new MockErc20(env.TEST_TOKEN_ADDRESS, provider);

const client = new Client(`http://localhost:${env.PORT}`);

const { wallets: walletDetails } = await createTestWalletsCached(
  provider,
  sendWalletCount + 1,
);

const [recvWallet, ...sendWallets] = await Promise.all(walletDetails.map(
  ({ blsSecret }) => BlsWallet.connect(blsSecret, provider),
));

const startBalance = await testErc20.balanceOf(recvWallet.walletAddress);

const nextNonceMap = new Map<BlsWallet, number>(
  await Promise.all(sendWallets.map(async (sendWallet) => {
    const nextNonce = await sendWallet.Nonce();

    return [sendWallet, nextNonce] as const;
  })),
);

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
      args: [recvWallet.walletAddress, "1"],
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

  const balance = await testErc20.balanceOf(recvWallet.walletAddress);
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
