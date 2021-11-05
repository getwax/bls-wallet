import * as hubbleBls from "../deps/hubble-bls";

import encodeMessageForSigning from "./encodeMessageForSigning";
import { Transaction } from "./types";

export default (
  domain: Uint8Array,
  chainId: number,
) => (tx: Transaction): boolean => {
  const verifier = new hubbleBls.signer.BlsVerifier(domain);

  return verifier.verifyMultiple(
    hubbleBls.mcl.loadG1(tx.signature),
    tx.subTransactions.map(
      subTx => hubbleBls.mcl.loadG2(subTx.publicKey),
    ),
    tx.subTransactions.map(
      subTx => encodeMessageForSigning(chainId)(subTx),
    ),
  );
};
