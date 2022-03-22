import { signer, mcl } from "@thehubbleproject/bls";

export default (signerFactory: signer.BlsSignerFactory, domain: Uint8Array) =>
  (message: string, privateKey: string): mcl.solG1 => {
    const signer = signerFactory.getSigner(domain, privateKey);
    return signer.sign(message);
  };
