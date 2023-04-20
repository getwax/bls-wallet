import { keccak256, solidityPack } from "ethers/lib/utils";
import { Operation } from "./types";

export default () =>
  (operation: Operation, walletAddress: string): string => {
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
      ["address", "uint256", "bytes32"],
      [walletAddress, operation.nonce, keccak256(encodedActionData)],
    );
  };
