import { keccak256 } from "@ethersproject/keccak256";
import { pack as solidityPack } from "@ethersproject/solidity";
import { RawTransactionData } from "./types";

const sendOnlyHash = '0x53454e445f4f4e4c590000000000000000000000000000000000000000000000';

export default (
  chainId: number,
) => (
  rawTxData: RawTransactionData,
): string => {
  const hash = rawTxData.encodedFunctionData === '0x'
    ? sendOnlyHash
    : keccak256(solidityPack(
      ["bytes"],
      [rawTxData.encodedFunctionData],
    ));

  return solidityPack(
    ["uint256", "uint256", "uint256", "uint256", "address", "bytes32"],
    [
      chainId,
      rawTxData.nonce,
      rawTxData.tokenRewardAmount,
      rawTxData.ethValue,
      rawTxData.contractAddress,
      hash,
    ]
  );
}
