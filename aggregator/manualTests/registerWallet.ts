#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

import { ContractsConnector, ethers } from "../deps.ts";
import * as env from "../src/env.ts";
import AdminWallet from "../src/chain/AdminWallet.ts";
import receiptOf from "./helpers/receiptOf.ts";

const provider = new ethers.providers.JsonRpcProvider(env.RPC_URL);

const adminWallet = AdminWallet(provider);

const connector = await ContractsConnector.create(adminWallet);

const addressRegistry = await connector.AddressRegistry();
const blsPublicKeyRegistry = await connector.BLSPublicKeyRegistry();

await receiptOf(
  addressRegistry.register("0xCB1ca1e8DF1055636d7D07c3099c9de3c65CAAB4"),
);

await receiptOf(
  blsPublicKeyRegistry.register(
    // You can get this in Quill by running this in the console of the wallet
    // page (the page you get by clicking on the extension icon)
    // JSON.stringify(debug.wallets[0].blsWalletSigner.getPublicKey())

    [
      "0x0ad7e63a4bbfdad440beda1fe7fdfb77a59f2a6d991700c6cf4c3654a52389a9",
      "0x0adaa93bdfda0f6b259a80c1af7ccf3451c35c1e175483927a8052bdbf59f801",
      "0x1f56aa1bb1419c741f0a474e51f33da0ffc81ea870e2e2c440db72539a9efb9e",
      "0x2f1f7e5d586d6ca5de3c8c198c3be3b998a2b6df7ee8a367a1e58f8b36fd524d",
    ],
  ),
);
