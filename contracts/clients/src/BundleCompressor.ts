import { ethers } from "ethers";
import { encodeVLQ, hexJoin } from "./encodeUtils";
import IOperationCompressor from "./IOperationCompressor";
import { Bundle, Operation, PublicKey } from "./signer";
import Range from "./helpers/Range";
import { BLSExpanderDelegator } from "../typechain-types";

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

  constructor(public blsExpanderDelegator: BLSExpanderDelegator) {}

  /** Add an operation compressor. */
  async addCompressor(compressor: IOperationCompressor) {
    const registrations = await this.blsExpanderDelegator.queryFilter(
      this.blsExpanderDelegator.filters.ExpanderRegistered(
        null,
        compressor.getExpanderAddress(),
      ),
    );

    const id = registrations.at(0)?.args?.id;

    if (id === undefined) {
      throw new Error("Expander not registered");
    }

    this.compressors.push([id.toNumber(), compressor]);
  }

  /** Compresses a single operation. */
  async compressOperation(
    blsPublicKey: PublicKey,
    operation: Operation,
  ): Promise<string> {
    let expanderIndexAndData: [number, string] | undefined;

    for (const [expanderIndex, compressor] of this.compressors) {
      let data: string | undefined;

      try {
        data = await compressor.compress(blsPublicKey, operation);
      } catch {
        continue;
      }

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
