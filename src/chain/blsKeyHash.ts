import { ethers } from "../../deps.ts";

export default function blsKeyHash(publicKey: string) {
  return ethers.utils.keccak256(ethers.utils.solidityPack(
    ["uint256[4]"],
    [publicKey],
  ));
}
