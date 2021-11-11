import { BigNumber } from "ethers";
import { ethers } from "hardhat";

const { utils } = ethers;

/**
 * Payload for single action (TODO: multiple)
 * @param encodedFunction "0x" is expected (representing 0 bytes) for calls without a function or params, ie just sending ETH.
 * @returns 
 */
export default function dataPayload(
  chainId: number,
  nonce: number,
  ethValue: BigNumber,
  contractAddress: string,
  encodedFunction: string,
) {

  let encodedActionData = utils.solidityPack(
    ["uint256", "address", "bytes32"],
    [
      ethValue,
      contractAddress.toString(),
      utils.solidityKeccak256(
        ["bytes"],
        [encodedFunction]
      )
    ]
  );

  let encodedActionDataHash = utils.solidityKeccak256(
    ["bytes"],
    [encodedActionData]
  )

  return utils.solidityPack(
    ["uint256", "uint256", "bytes32"],
    [
      chainId,
      nonce,
      encodedActionDataHash
    ],
  );
}
