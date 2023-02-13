#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write

import { ethers } from "../deps.ts";

import * as env from "../src/env.ts";
import TestBlsWallet from "./helpers/TestBlsWallet.ts";

const wallet = await TestBlsWallet(
  new ethers.providers.JsonRpcProvider(env.RPC_URL),
);

console.log({
  privateKey: wallet.privateKey,
  address: wallet.walletContract.address,
});
