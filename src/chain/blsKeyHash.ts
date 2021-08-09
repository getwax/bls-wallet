import { ethers, hubbleBls } from "../../deps/index.ts";

const { utils } = ethers;

type BlsSignerInterface = hubbleBls.signer.BlsSignerInterface;

export default function blsKeyHash(blsSigner: BlsSignerInterface) {
  return utils.keccak256(utils.solidityPack(
    ["uint256[4]"],
    [blsSigner.pubkey],
  ));
}
