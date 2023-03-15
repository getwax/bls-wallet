import { ethers } from "ethers";
import { encodeVLQ, hexJoin } from "./encodeUtils";
import IOperationCompressor from "./IOperationCompressor";
import { Bundle, Operation, PublicKey } from "./signer";
import Range from "./helpers/Range";

export default class BundleCompressor {
  compressors: [number, IOperationCompressor][] = [];

  addCompressor(expanderIndex: number, compressor: IOperationCompressor) {
    this.compressors.push([expanderIndex, compressor]);
  }

  async compressOperation(
    blsPublicKey: PublicKey,
    operation: Operation,
  ): Promise<string> {
    let expanderIndexAndData: [number, string] | undefined;

    for (const [expanderIndex, compressor] of this.compressors) {
      const data = await compressor.compress(blsPublicKey, operation);

      if (data === undefined) {
        continue;
      }

      expanderIndexAndData = [expanderIndex, data];
      break;
    }

    if (expanderIndexAndData === undefined) {
      throw new Error("Failed to compress operation");
    }

    const [expanderIndex, data] = expanderIndexAndData;

    return hexJoin([encodeVLQ(expanderIndex), data]);
  }

  async compress(bundle: Bundle): Promise<string> {
    const len = bundle.operations.length;

    if (bundle.senderPublicKeys.length !== len) {
      throw new Error("ops vs keys length mismatch");
    }

    const compressedOperations = await Promise.all(
      Range(len).map((i) =>
        this.compressOperation(
          bundle.senderPublicKeys[i],
          bundle.operations[i],
        ),
      ),
    );

    return hexJoin([
      encodeVLQ(bundle.operations.length),
      ...compressedOperations,
      ethers.utils.defaultAbiCoder.encode(["uint256[2]"], [bundle.signature]),
    ]);
  }
}
