import { signer } from "@thehubbleproject/bls";
import { PublicKey } from "./types";

export default (signerFactory: signer.BlsSignerFactory, domain: Uint8Array) =>
  (privateKey: string): PublicKey => {
    const signer = signerFactory.getSigner(domain, privateKey);
    return signer.pubkey;
  };
