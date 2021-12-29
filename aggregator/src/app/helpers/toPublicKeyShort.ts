import { ethers, PublicKey } from "../../../deps.ts";

export default function toShortPublicKey(publicKey: PublicKey) {
  return ethers.utils.solidityPack(["uint256"], [publicKey[0]]).slice(2, 9);
}
