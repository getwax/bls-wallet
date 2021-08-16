import * as hubbleBls from "../deps/hubble-bls";
import domain from "./domain";

export default function getBlsPublicKey(privateKey: string) {
  const signer = new hubbleBls.signer.BlsSigner(domain, privateKey);

  return hubbleBls.mcl.dumpG2(signer.pubkey);
}
