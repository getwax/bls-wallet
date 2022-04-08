import { ethers } from "../deps.ts";
import * as env from "../src/env.ts";
import AdminWallet from "../src/chain/AdminWallet.ts";

const provider = new ethers.providers.JsonRpcProvider(env.RPC_URL);

const adminWallet = AdminWallet(provider);

await (await adminWallet.sendTransaction({
  value: "0x01",
  to: ethers.constants.AddressZero,
})).wait();
