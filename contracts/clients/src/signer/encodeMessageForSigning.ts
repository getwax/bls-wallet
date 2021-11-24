import { keccak256 } from "@ethersproject/keccak256";
import { pack as solidityPack } from "@ethersproject/solidity";
import { TransactionTemplate } from "./types";

export default (
  chainId: number,
) => (
  txTemplate: TransactionTemplate,
): string => {
  let encodedActionData = "0x";

  for (const action of txTemplate.actions) {
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
      txTemplate.nonce,
      keccak256(encodedActionData),
    ],
  );
}
