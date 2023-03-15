import { ethers } from "ethers";
import { encodeVLQ, hexJoin } from "./encodeUtils";
import IOperationCompressor from "./IOperationCompressor";
import { Bundle, Operation, PublicKey } from "./signer";
import Range from "./helpers/Range";

/**
 * Produces compressed bundles that can be passed to `BLSExpanderDelegator.run`
 * instead of `VerificationGateway.processBundle`.
 *
 * The compression of operations is delegated to other compressors that you
 * inject using `.addCompressor`. For each operation of the bundle, these
 * compressors are tried in the order they were added, and the first one that
 * succeeds is used. Note that `expanderIndex` is unrelated to this order - it
 * just needs to match the index that the corresponding expander contract is
 * registered at in BLSExpanderDelegator.
 */
export default class BundleCompressor {
  compressors: [number, IOperationCompressor][] = [];

  /** Add an operation compressor. */
  addCompressor(expanderIndex: number, compressor: IOperationCompressor) {
    this.compressors.push([expanderIndex, compressor]);
  }

  /** Compresses a single operation. */
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

  /** Compresses a bundle. */
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
