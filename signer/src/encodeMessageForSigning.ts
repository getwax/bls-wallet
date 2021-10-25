import { keccak256 } from "@ethersproject/keccak256";
import { pack as solidityPack } from "@ethersproject/solidity";
import { RawTransactionData } from "./types";

export default (
  chainId: number,
) => (
  rawTxData: RawTransactionData,
): string => {
  return solidityPack(
    ["uint256", "uint256", "uint256", "address", "bytes32"],
    [
      chainId,
      rawTxData.nonce,
      rawTxData.ethValue,
      rawTxData.contractAddress,
      keccak256(rawTxData.encodedFunction),
    ]
  );
}
