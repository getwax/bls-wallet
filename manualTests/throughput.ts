import { ethers } from "../deps/index.ts";

import Client from "../src/app/Client.ts";
import Wallet from "../src/chain/Wallet.ts";
import delay from "../src/helpers/delay.ts";
import * as env from "../test/env.ts";
import MockErc20 from "../test/helpers/MockErc20.ts";
import createTestWallets from "./helpers/createTestWallets.ts";

const leadTarget = 50;
const pollingInterval = 400;

const provider = new ethers.providers.JsonRpcProvider();

const testErc20 = new MockErc20(env.TEST_TOKEN_ADDRESS, provider);

const client = new Client(`http://localhost:${env.PORT}`);

const { wallets: walletDetails } = await createTestWallets(2);

const [sendWallet, recvWallet] = await Promise.all(walletDetails.map(
  ({ blsSecret }) => Wallet.connect(blsSecret, provider),
));

const startBalance = await testErc20.balanceOf(sendWallet.walletAddress);

let nextNonce = await sendWallet.Nonce();

let txsSent = 0;
let txsAdded = 0;
let txsCompleted = 0;

(async () => {
  while (true) {
    const lead = txsSent - txsCompleted;
    const leadDeficit = leadTarget - lead;

    for (let i = 0; i < leadDeficit; i++) {
      const tx = sendWallet.buildTx({
        contract: testErc20.contract,
        method: "transfer",
        args: [recvWallet.walletAddress, "1"],
        nonce: nextNonce++,
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
    const balance = await testErc20.balanceOf(sendWallet.walletAddress);
    const oldTxsCompleted = txsCompleted;
    txsCompleted = startBalance.sub(balance).toNumber();
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
