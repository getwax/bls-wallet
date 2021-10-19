import { BigNumber } from "ethers";
import { ethers } from "hardhat";

const { utils } = ethers;

/**
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
  let encodedFunctionHash = utils.solidityKeccak256(
    ["bytes"],
    [encodedFunction]
  );

  return utils.solidityPack(
    ["uint256", "uint256", "uint256", "address", "bytes32"],
    [
      chainId,
      nonce,
      ethValue,
      contractAddress.toString(),
      encodedFunctionHash
    ],
  );
}
