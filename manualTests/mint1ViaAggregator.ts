import { ethers } from "../deps/index.ts";

import Client from "../src/app/Client.ts";
import Wallet from "../src/chain/Wallet.ts";
import assert from "../src/helpers/assert.ts";
import delay from "../src/helpers/delay.ts";
import * as env from "../test/env.ts";
import MockErc20 from "../test/helpers/MockErc20.ts";
import createTestWallet from "./helpers/createTestWallet.ts";

const provider = new ethers.providers.JsonRpcProvider();

const testErc20 = new MockErc20(env.TEST_TOKEN_ADDRESS, provider);

const client = new Client(`http://localhost:${env.PORT}`);

const { blsSecret } = await createTestWallet();
const wallet = await Wallet.connect(blsSecret, provider);

const startBalance = await testErc20.balanceOf(wallet.walletAddress);

let nextNonce = await wallet.Nonce();

const tx = wallet.buildTx({
  contract: testErc20.contract,
  method: "mint",
  args: [wallet.walletAddress, "1"],
  nonce: nextNonce++,
});

console.log("Sending mint tx to aggregator");

const failures = await client.addTransaction(tx);
assert(failures.length === 0);

console.log("Success response from aggregator");

while (true) {
  const balance = (await testErc20.balanceOf(wallet.walletAddress));

  console.log({
    startBalance: startBalance.toString(),
    balance: balance.toString(),
  });

  if (!balance.eq(startBalance)) {
    console.log("done");
    break;
  }

  console.log("Balance has not increased, waiting 500ms");
  await delay(500);
}
