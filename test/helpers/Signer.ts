import { ethers, Wallet } from "../deps.ts";

import * as env from "../env.ts";

export default function Signer(
  provider: ethers.providers.Provider,
  privateKey: string,
) {
  const signer = new Wallet(privateKey, provider);

  if (env.USE_TEST_NET) {
    const originalPopulateTransaction = signer.populateTransaction
      .bind(signer);

    signer.populateTransaction = (transaction) => {
      transaction.gasPrice = 0;
      return originalPopulateTransaction(transaction);
    };
  }

  return signer;
}
