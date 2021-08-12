import { ethers, Wallet } from "../../deps/index.ts";

import * as env from "../env.ts";

export default function AdminWallet(provider: ethers.providers.Provider) {
  const wallet = new Wallet(env.PRIVATE_KEY_ADMIN, provider);

  if (env.USE_TEST_NET) {
    const originalPopulateTransaction = wallet.populateTransaction
      .bind(wallet);

    wallet.populateTransaction = (transaction) => {
      transaction.gasPrice = 0;
      return originalPopulateTransaction(transaction);
    };
  }

  return wallet;
}
