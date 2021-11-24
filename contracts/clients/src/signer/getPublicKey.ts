import * as hubbleBls from "../../deps/hubble-bls";

export default (
  signerFactory: hubbleBls.signer.BlsSignerFactory,
  domain: Uint8Array
) => (
  privateKey: string
): string => {
  const signer = signerFactory.getSigner(domain, privateKey);

  return hubbleBls.mcl.dumpG2(signer.pubkey);
};
