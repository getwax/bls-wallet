import * as hubbleBls from "../../deps/hubble-bls";
import { PublicKey } from "./types";

export default (
    signerFactory: hubbleBls.signer.BlsSignerFactory,
    domain: Uint8Array,
  ) =>
  (privateKey: string): PublicKey => {
    const signer = signerFactory.getSigner(domain, privateKey);

    return signer.pubkey;
  };
