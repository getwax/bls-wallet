import { keccak256 } from "@ethersproject/keccak256";

import getPublicKey from "./getPublicKey";

export default (
  domain: Uint8Array
) => (
  privateKey: string
): string => {
  const publicKey = getPublicKey(domain)(privateKey);
  return keccak256(publicKey);
};
