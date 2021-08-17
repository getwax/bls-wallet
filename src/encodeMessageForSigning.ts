import { keccak256 } from "@ethersproject/keccak256";
import { pack as solidityPack } from "@ethersproject/solidity";
import { RawTransactionData } from "./types";

export default (
  chainId: number,
) => (
  rawTxData: RawTransactionData,
): string => {
  const encodedFunctionHash = keccak256(solidityPack(
    ["bytes"],
    [rawTxData.encodedFunctionData],
  ));

  return solidityPack(
    ["uint256", "uint256", "uint256", "address", "bytes32"],
    [
      chainId,
      rawTxData.nonce,
      rawTxData.tokenRewardAmount,
      rawTxData.contractAddress,
      encodedFunctionHash,
    ]
  );
}
