#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write --unstable

import { ethers } from "../deps/index.ts";
import TestBlsWallets from "./helpers/TestBlsWallets.ts";

const [wallet] = await TestBlsWallets(
  new ethers.providers.JsonRpcProvider(),
  1,
);

console.log({
  secret: wallet.secret,
  address: wallet.walletContract.address,
});
