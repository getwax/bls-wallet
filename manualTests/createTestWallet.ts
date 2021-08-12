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
