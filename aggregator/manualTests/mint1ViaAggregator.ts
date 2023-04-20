#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write

import {
  ActionData,
  AggregatorClient,
  AggregatorUtilitiesFactory,
  BigNumber,
  delay,
  ethers,
  MockERC20Factory,
} from "../deps.ts";
import AdminWallet from "../src/chain/AdminWallet.ts";
import assert from "../src/helpers/assert.ts";

import getNetworkConfig from "../src/helpers/getNetworkConfig.ts";
import * as env from "../test/env.ts";
import TestBlsWallet from "./helpers/TestBlsWallet.ts";

const [walletIndexStr = "0"] = Deno.args;
const walletIndex = Number(walletIndexStr);

const { addresses } = await getNetworkConfig();

const provider = new ethers.providers.JsonRpcProvider(env.RPC_URL);
const testErc20 = MockERC20Factory.connect(addresses.testToken, provider);
const client = new AggregatorClient(env.ORIGIN);

const wallet = await TestBlsWallet(provider, walletIndex);
const nonce = await wallet.Nonce();

const adminWallet = AdminWallet(provider);

console.log("Funding wallet");

await (await adminWallet.sendTransaction({
  to: wallet.address,
  value: 1,
})).wait();

const startBalance = await testErc20.balanceOf(wallet.address);

const mintAction: ActionData = {
  ethValue: 0,
  contractAddress: testErc20.address,
  encodedFunction: testErc20.interface.encodeFunctionData(
    "mint",
    [wallet.address, 1],
  ),
};

const sendEthToTxOrigin = AggregatorUtilitiesFactory
  .createInterface()
  .encodeFunctionData("sendEthToTxOrigin");

const feeEstimation = await client.estimateFee(
  await wallet.signWithGasEstimate({
    nonce,
    actions: [
      mintAction,
      {
        ethValue: 1,
        contractAddress: addresses.utilities,
        encodedFunction: sendEthToTxOrigin,
      },
    ],
  }),
);

console.log({ feeEstimation });

assert(feeEstimation.feeType === "ether");

const feeRequired = BigNumber.from(feeEstimation.feeRequired);

// Add 10% safety margin
const fee = feeRequired.add(feeRequired.div(10));

const balance = await provider.getBalance(wallet.address);

// Ensure wallet can pay the fee
if (balance.lt(fee)) {
  console.log("Funding wallet");

  await (await adminWallet.sendTransaction({
    to: wallet.address,
    value: fee.sub(balance),
  })).wait();
}

const feeAction: ActionData = {
  ethValue: fee,
  contractAddress: addresses.utilities,
  encodedFunction: sendEthToTxOrigin,
};

const bundle = await wallet.signWithGasEstimate({
  nonce: await wallet.Nonce(),
  actions: [mintAction, feeAction],
});

console.log("Sending mint bundle to aggregator");

const res = await client.add(bundle);
if ("failures" in res) {
  throw new Error(res.failures.map((f) => f.description).join(", "));
}

console.log("Success response from aggregator", res.hash);

while (true) {
  const balance = await testErc20.balanceOf(wallet.address);

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
