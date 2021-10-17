import * as hubbleBls from "../deps/hubble-bls";

import encodeMessageForSigning from "./encodeMessageForSigning";
import { AggregateTransactionData } from "./types";

export default (
  domain: Uint8Array,
  chainId: number,
) => (
  aggregateTxData: AggregateTransactionData,
): boolean => {
  const verifier = new hubbleBls.signer.BlsVerifier(domain);

  return verifier.verifyMultiple(
    hubbleBls.mcl.loadG1(aggregateTxData.signature),
    aggregateTxData.transactions.map(
      tx => hubbleBls.mcl.loadG2(tx.publicKey),
    ),
    aggregateTxData.transactions.map(
      tx => encodeMessageForSigning(chainId)(tx),
    ),
  );
};
