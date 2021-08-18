#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write --unstable

import Client from "../src/app/Client.ts";
import * as env from "../src/env.ts";
import Fixture from "../test/helpers/Fixture.ts";

const client = new Client(env.ORIGIN);

const fx = await Fixture.create(import.meta.url);
const [{ blsSigner, blsWallet }] = await fx.setupWallets(1);

const tx = await fx.createTxData({
  blsSigner,
  contract: fx.walletService.erc20,
  method: "mint",
  args: [blsWallet.address, "20"],
});

console.log("sending", tx);

const failures = await client.addTransaction(tx);

console.log({ failures });
