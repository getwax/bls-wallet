import { keccak256 } from "@ethersproject/keccak256";
import { pack as solidityPack } from "@ethersproject/solidity";
import { Operation } from "./types";

export default (
  chainId: number,
) => (
  operation: Operation,
): string => {
  let encodedActionData = "0x";

  for (const action of operation.actions) {
    encodedActionData = solidityPack(
      ["bytes", "uint256", "address", "bytes32"],
      [
        encodedActionData,
        action.ethValue,
        action.contractAddress,
        keccak256(action.encodedFunction),
      ],
    );
  }

  return solidityPack(
    ["uint256", "uint256", "bytes32"],
    [
      chainId,
      operation.nonce,
      keccak256(encodedActionData),
    ],
  );
}
