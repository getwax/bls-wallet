import { keccak256 } from "@ethersproject/keccak256";
import { BlsSignerFactory } from "../../deps/hubble-bls/signer";

import getPublicKey from "./getPublicKey";

export default (
  signerFactory: BlsSignerFactory,
  domain: Uint8Array
) => (
  privateKey: string
): string => {
  const publicKey = getPublicKey(signerFactory, domain)(privateKey);
  return keccak256(publicKey);
};
