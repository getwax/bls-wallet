import { Operation, PublicKey } from "./signer";

type IOperationCompressor = {
  getExpanderAddress(): string;

  compress(
    blsPublicKey: PublicKey,
    operation: Operation,
  ): Promise<string | undefined>;
};

export default IOperationCompressor;
