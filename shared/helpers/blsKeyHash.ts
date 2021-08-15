import { ethers } from "hardhat";
import { BlsSignerFactory, BlsSignerInterface, aggregate } from "../lib/hubble-bls/src/signer";

const { utils } = ethers;


export default function blsKeyHash(blsSigner: BlsSignerInterface) {
  return utils.keccak256(utils.solidityPack(
    ["uint256[4]"],
    [blsSigner.pubkey],
  ));
}
