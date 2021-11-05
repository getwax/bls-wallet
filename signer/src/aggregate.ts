import * as hubbleBls from "../deps/hubble-bls";

import { AggregateTransactionData, TransactionData } from "./types";

export default (txs: TransactionData[]): AggregateTransactionData => {
  const sigsG1 = txs.map(tx => hubbleBls.mcl.loadG1(tx.signature));
  const aggSigG1 = hubbleBls.signer.aggregate(sigsG1);

  const aggregateSignature = hubbleBls.mcl.dumpG1(aggSigG1);

  return {
    transactions: txs.map(tx => ({
      publicKey: tx.publicKey,
      nonce: tx.nonce,
      ethValue: tx.ethValue,
      contractAddress: tx.contractAddress,
      encodedFunction: tx.encodedFunction,
    })),
    signature: aggregateSignature,
  };
}
