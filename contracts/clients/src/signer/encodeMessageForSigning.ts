import { keccak256, solidityPack } from "ethers/lib/utils";
import { Operation } from "./types";

export default (chainId: number, publicKeyHash: string) =>
  (operation: Operation): string => {
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
      ["uint256", "bytes32", "uint256", "bytes32"],
      [chainId, publicKeyHash, operation.nonce, keccak256(encodedActionData)],
    );
  };
