import { BigNumber } from "ethers";
import { ethers } from "hardhat";

const { utils } = ethers;


/** Sending ETH without a function call is handled by passing an empty string
 * as the functionName. In place of an encoded function string, SEND_ONLY
 * is used as a special string to sign for. Any special handling of an encoded
 * function hash (0 or otherwise), risks signatures being valid for another
 * contract and function (with a brute-forced param since params would
 * be ignored, and the ether sent to the attacker's contract).
 */
// bytes32 of "SEND_ONLY" characters with trailing 0s
const SEND_ONLY: string = "0x53454e445f4f4e4c590000000000000000000000000000000000000000000000";

export default function dataPayload(
  chainId: number,
  nonce: number,
  reward: BigNumber,
  ethValue: BigNumber,
  contractAddress: string,
  encodedFunction: string,
) {
  let encodedFunctionHash = SEND_ONLY;
  if (encodedFunction !== "") {
    encodedFunctionHash = utils.solidityKeccak256(
      ["bytes"],
      [encodedFunction]
    );
  }

  return utils.solidityPack(
    ["uint256", "uint256", "uint256", "uint256", "address", "bytes32"],
    [
      chainId,
      nonce,
      reward,
      ethValue,
      contractAddress.toString(),
      encodedFunctionHash
    ],
  );
}
