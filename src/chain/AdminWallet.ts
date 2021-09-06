import { ethers, Wallet } from "../../deps.ts";

import * as env from "../env.ts";

export default function AdminWallet(
  provider: ethers.providers.Provider,
  privateKey = env.PRIVATE_KEY_ADMIN,
) {
  const wallet = new Wallet(privateKey, provider);

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
