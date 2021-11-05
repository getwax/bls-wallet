import { keccak256 } from "@ethersproject/keccak256";
import { pack as solidityPack } from "@ethersproject/solidity";
import { TransactionTemplate } from "./types";

export default (
  chainId: number,
) => (
  txTemplate: TransactionTemplate,
): string => {
  return solidityPack(
    ["uint256", "uint256", "uint256", "address", "bytes32"],
    [
      chainId,
      txTemplate.nonce,
      txTemplate.ethValue,
      txTemplate.contractAddress,
      keccak256(txTemplate.encodedFunction),
    ]
  );
}
