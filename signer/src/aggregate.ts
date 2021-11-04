import * as hubbleBls from "../deps/hubble-bls";

import { TransactionSet } from "./types";

export default (txSets: TransactionSet[]): TransactionSet => {
  const sigsG1 = txSets.map(txSet => hubbleBls.mcl.loadG1(txSet.signature));
  const aggSigG1 = hubbleBls.signer.aggregate(sigsG1);

  const aggregateSignature = hubbleBls.mcl.dumpG1(aggSigG1);

  return {
    transactions: txSets.map(txSet => txSet.transactions).flat(),
    signature: aggregateSignature,
  };
}
