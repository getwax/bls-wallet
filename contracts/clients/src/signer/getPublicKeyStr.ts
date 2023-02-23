import { signer, mcl } from "@thehubbleproject/bls";

export default (
    signerFactory: signer.BlsSignerFactory,
    domain: Uint8Array,
    privateKey: string,
  ) =>
  (): string => {
    const signer = signerFactory.getSigner(domain, privateKey);
    return mcl.dumpG2(signer.pubkey);
  };
