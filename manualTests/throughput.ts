import { delay, ethers } from "../deps/index.ts";

import Client from "../src/app/Client.ts";
import Wallet from "../src/chain/Wallet.ts";
import * as env from "../test/env.ts";
import MockErc20 from "../test/helpers/MockErc20.ts";
import createTestWalletsCached from "./helpers/createTestWalletsCached.ts";

const leadTarget = 50;
const pollingInterval = 400;
const sendWalletCount = 50;

const provider = new ethers.providers.JsonRpcProvider();

const testErc20 = new MockErc20(env.TEST_TOKEN_ADDRESS, provider);

const client = new Client(`http://localhost:${env.PORT}`);

const { wallets: walletDetails } = await createTestWalletsCached(
  provider,
  sendWalletCount + 1,
);

const [recvWallet, ...sendWallets] = await Promise.all(walletDetails.map(
  ({ blsSecret }) => Wallet.connect(blsSecret, provider),
));

const startBalance = await testErc20.balanceOf(recvWallet.walletAddress);

const nextNonceMap = new Map<Wallet, number>(
  await Promise.all(sendWallets.map(async (sendWallet) => {
    const nextNonce = await sendWallet.Nonce();

    return [sendWallet, nextNonce] as const;
  })),
);

let txsSent = 0;
let txsAdded = 0;
let txsCompleted = 0;
let sendWalletIndex = 0;

(async () => {
  while (true) {
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

    await delay(pollingInterval);
  }
})();

let txsCompletedUpdateTime = Date.now();
let txsPerSec = 0;

(async () => {
  while (true) {
    const balance = await testErc20.balanceOf(recvWallet.walletAddress);
    const oldTxsCompleted = txsCompleted;
    txsCompleted = balance.sub(startBalance).toNumber();
    const newTxsCompleted = txsCompleted - oldTxsCompleted;

    if (newTxsCompleted > 0) {
      const oldUpdateTime = txsCompletedUpdateTime;
      txsCompletedUpdateTime = Date.now();

      txsPerSec = 1000 * newTxsCompleted /
        (txsCompletedUpdateTime - oldUpdateTime);
    }

    await delay(pollingInterval);
  }
})();

(async () => {
  while (true) {
    console.clear();

    console.log({
      txsSent,
      txsAdded,
      txsCompleted,
      txsPerSec: txsPerSec.toFixed(1),
    });

    await delay(pollingInterval);
  }
})();
