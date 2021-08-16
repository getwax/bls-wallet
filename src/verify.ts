import * as hubbleBls from "../deps/hubble-bls";

import domain from "./domain";
import encodeMessageForSigning from "./encodeMessageForSigning";
import { TransactionData } from "./types";

export default function verify(
  chainId: number,
  txData: TransactionData,
): boolean {
  const verifier = new hubbleBls.signer.BlsVerifier(domain);

  return verifier.verify(
    hubbleBls.mcl.loadG1(txData.signature),
    hubbleBls.mcl.loadG2(txData.publicKey),
    encodeMessageForSigning(chainId, txData),
  );
}
