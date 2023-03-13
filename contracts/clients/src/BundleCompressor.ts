import { ethers } from "ethers";
import { encodeVLQ, hexJoin } from "./encodeUtils";
import IOperationCompressor from "./IOperationCompressor";
import { Bundle } from "./signer";

export default class BundleCompressor {
  compressors: [number, IOperationCompressor][] = [];

  addCompressor(expanderIndex: number, compressor: IOperationCompressor) {
    this.compressors.push([expanderIndex, compressor]);
  }

  compress(bundle: Bundle): string {
    const compressedOperations: string[] = [];

    const len = bundle.operations.length;

    if (bundle.senderPublicKeys.length !== len) {
      throw new Error("ops vs keys length mismatch");
    }

    for (let i = 0; i < len; i++) {
      let expanderIndexAndData: [number, string] | undefined;

      for (const [expanderIndex, compressor] of this.compressors) {
        const data = compressor.compress(
          bundle.senderPublicKeys[i],
          bundle.operations[i],
        );

        if (data === undefined) {
          continue;
        }

        expanderIndexAndData = [expanderIndex, data];
        break;
      }

      if (expanderIndexAndData === undefined) {
        throw new Error(`Failed to compress operation i=${i}`);
      }

      const [expanderIndex, data] = expanderIndexAndData;

      compressedOperations.push(hexJoin([encodeVLQ(expanderIndex), data]));
    }

    return hexJoin([
      encodeVLQ(bundle.operations.length),
      ...compressedOperations,
      ethers.utils.defaultAbiCoder.encode(["uint256[2]"], [bundle.signature]),
    ]);
  }
}
