import * as hubbleBls from "../deps/hubble-bls";

export default (
  domain: Uint8Array
) => (
  privateKey: string
): string => {
  const signer = new hubbleBls.signer.BlsSigner(
    domain,
    hubbleBls.mcl.parseFr(privateKey),
  );

  return hubbleBls.mcl.dumpG2(signer.pubkey);
};
