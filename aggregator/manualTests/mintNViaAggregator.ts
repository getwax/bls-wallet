#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write

import { ActionData } from "https://esm.sh/v99/bls-wallet-clients@0.8.0-efa2e06/dist/src/index.d.ts";
import {
  AggregatorClient,
  AggregatorUtilitiesFactory,
  BigNumber,
  Bundle,
  delay,
  ethers,
  MockERC20Factory,
} from "../deps.ts";
import AdminWallet from "../src/chain/AdminWallet.ts";
import assert from "../src/helpers/assert.ts";

import getNetworkConfig from "../src/helpers/getNetworkConfig.ts";
import Range from "../src/helpers/Range.ts";
import * as env from "../test/env.ts";
import TestBlsWallet from "./helpers/TestBlsWallet.ts";

const [walletNStr] = Deno.args;
const walletN = Number(walletNStr);

if (!Number.isFinite(walletN)) {
  console.error("Usage: ./manualTests/mintNViaAggregator.ts <N>");
  Deno.exit(1);
}

const { addresses } = await getNetworkConfig();

const provider = new ethers.providers.JsonRpcProvider(env.RPC_URL);
const testErc20 = MockERC20Factory.connect(addresses.testToken, provider);
const client = new AggregatorClient(env.ORIGIN);

const sendEthToTxOrigin = AggregatorUtilitiesFactory
  .createInterface()
  .encodeFunctionData("sendEthToTxOrigin");

const adminWallet = AdminWallet(provider);

const wallets = await Promise.all(
  Range(walletN).map((i) => TestBlsWallet(provider, i)),
);

const firstWallet = wallets[0];

const mintAction: ActionData = {
  ethValue: 0,
  contractAddress: testErc20.address,
  encodedFunction: testErc20.interface.encodeFunctionData(
    "mint",
    [wallets[0].address, 1],
  ),
};

const startBalance = await testErc20.balanceOf(firstWallet.address);

const bundles: Bundle[] = [];

for (const [i, wallet] of wallets.entries()) {
  const nonce = await wallet.Nonce();

  console.log("Funding wallet", i);

  await (await adminWallet.sendTransaction({
    to: wallet.address,
    value: 1,
  })).wait();

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

  bundles.push(
    await wallet.signWithGasEstimate({
      nonce,
      actions: [mintAction, feeAction],
    }),
  );
}

console.log("Sending mint bundles to aggregator");

await Promise.all(bundles.map(async (bundle) => {
  const res = await client.add(bundle);

  if ("failures" in res) {
    throw new Error(res.failures.map((f) => f.description).join(", "));
  }

  console.log("Success response from aggregator", res.hash);
}));

while (true) {
  const balance = await testErc20.balanceOf(firstWallet.address);

  console.log({
    startBalance: startBalance.toString(),
    balance: balance.toString(),
  });

  if (balance.sub(startBalance).gte(walletN)) {
    console.log("done");
    break;
  }

  console.log("Mints not completed, waiting 500ms");
  await delay(500);
}
