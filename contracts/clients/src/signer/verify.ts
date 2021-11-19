import * as hubbleBls from "../../deps/hubble-bls";

import encodeMessageForSigning from "./encodeMessageForSigning";
import { Bundle } from "./types";

export default (
  domain: Uint8Array,
  chainId: number,
) => (bundle: Bundle): boolean => {
  const verifier = new hubbleBls.signer.BlsVerifier(domain);

  return verifier.verifyMultiple(
    bundle.signature,
    bundle.users,
    bundle.operations.map(encodeMessageForSigning(chainId)),
  );
};
