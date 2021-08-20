import { ethers } from "../../deps.ts";

import * as env from "../../test/env.ts";
import AdminWallet from "../../src/chain/AdminWallet.ts";
import BlsWallet from "../../src/chain/BlsWallet.ts";
import Range from "../../src/helpers/Range.ts";
import Rng from "../../src/helpers/Rng.ts";

export default async function TestBlsWallets(
  provider: ethers.providers.Provider,
  count: number,
) {
  const parent = AdminWallet(provider);
  const rng = Rng.root.seed(env.PRIVATE_KEY_ADMIN, env.TEST_BLS_WALLETS_SECRET);

  const existingWallets = await Promise.all(
    Range(count).map(async (i) => {
      const secret = rng.seed(`${i}`).address();
      return await BlsWallet.connect(secret, parent.provider);
    }),
  );

  const wallets: BlsWallet[] = [];

  for (let i = 0; i < count; i++) {
    const existingWallet = existingWallets[i];

    if (existingWallet) {
      wallets.push(existingWallet);
    } else {
      const secret = rng.seed(`${i}`).address();
      console.log(`Test wallet ${i} doesn't yet exist, creating...`);
      wallets.push(await BlsWallet.connectOrCreate(secret, parent));
      console.log("Created");
    }
  }

  return wallets;
}
