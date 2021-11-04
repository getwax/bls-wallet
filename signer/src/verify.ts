import * as hubbleBls from "../deps/hubble-bls";

import encodeMessageForSigning from "./encodeMessageForSigning";
import { TransactionSet } from "./types";

export default (
  domain: Uint8Array,
  chainId: number,
) => (
  txSet: TransactionSet,
): boolean => {
  const verifier = new hubbleBls.signer.BlsVerifier(domain);

  return verifier.verifyMultiple(
    hubbleBls.mcl.loadG1(txSet.signature),
    txSet.transactions.map(
      tx => hubbleBls.mcl.loadG2(tx.publicKey),
    ),
    txSet.transactions.map(
      tx => encodeMessageForSigning(chainId)(tx),
    ),
  );
};
