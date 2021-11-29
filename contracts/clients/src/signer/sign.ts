import * as hubbleBls from "../../deps/hubble-bls";

import encodeMessageForSigning from "./encodeMessageForSigning";
import { Bundle, Operation } from "./types";

export default (
    signerFactory: hubbleBls.signer.BlsSignerFactory,
    domain: Uint8Array,
    chainId: number,
  ) =>
  (operation: Operation, privateKey: string): Bundle => {
    const message = encodeMessageForSigning(chainId)(operation);
    const signer = signerFactory.getSigner(domain, privateKey);

    const signature = signer.sign(message);

    return {
      users: [signer.pubkey],
      operations: [operation],
      signature,
    };
  };
