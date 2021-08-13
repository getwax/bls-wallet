import { ethers } from "../../deps/index.ts";
import AdminWallet from "../../src/chain/AdminWallet.ts";
import BlsWallet from "../../src/chain/BlsWallet.ts";

import Rng from "../../src/helpers/Rng.ts";
import * as env from "../../test/env.ts";

export default async function TestBlsWallets(
  provider: ethers.providers.Provider,
  count: number,
) {
  const parent = AdminWallet(provider);
  const rng = Rng.root.seed(env.PRIVATE_KEY_ADMIN, env.TEST_BLS_WALLETS_SECRET);

  const wallets: BlsWallet[] = [];

  for (let i = 0; i < count; i++) {
    const secret = rng.seed(`${i}`).address();

    if (!await BlsWallet.Exists(secret, parent)) {
      console.log(`Test wallet ${i} doesn't yet exist, creating...`);
      wallets.push(await BlsWallet.create(secret, parent));
      console.log("Created");
    } else {
      wallets.push(await BlsWallet.connect(secret, parent.provider));
    }
  }

  return wallets;
}
