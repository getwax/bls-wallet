import { BlsWalletWrapper, ethers } from "../../deps.ts";

import * as env from "../../test/env.ts";
import AdminWallet from "../../src/chain/AdminWallet.ts";
import Range from "../../src/helpers/Range.ts";
import Rng from "../../src/helpers/Rng.ts";
import getNetworkConfig from "../../src/helpers/getNetworkConfig.ts";

export default async function TestBlsWallets(
  provider: ethers.providers.Provider,
  count: number,
) {
  const { addresses } = await getNetworkConfig();

  const parent = AdminWallet(provider);
  const rng = Rng.root.seed(env.PRIVATE_KEY_ADMIN, env.TEST_BLS_WALLETS_SECRET);

  const wallets = await Promise.all(
    Range(count).map(async (i) => {
      const secret = rng.seed(`${i}`).address();
      return await BlsWalletWrapper.connect(
        secret,
        addresses.verificationGateway,
        parent.provider,
      );
    }),
  );
  return wallets;
}
