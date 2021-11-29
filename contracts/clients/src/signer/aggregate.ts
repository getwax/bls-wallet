import * as hubbleBls from "../../deps/hubble-bls";

import { Transaction } from "./types";

export default (txs: Transaction[]): Transaction => {
  const sigsG1 = txs.map((tx) => hubbleBls.mcl.loadG1(tx.signature));
  const aggSigG1 = hubbleBls.signer.aggregate(sigsG1);

  return {
    subTransactions: txs.map((txSet) => txSet.subTransactions).flat(),
    signature: hubbleBls.mcl.dumpG1(aggSigG1),
  };
};
