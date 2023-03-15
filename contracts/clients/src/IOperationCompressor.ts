import { Operation, PublicKey } from "./signer";

type IOperationCompressor = {
  compress(
    blsPublicKey: PublicKey,
    operation: Operation,
  ): Promise<string | undefined>;
};

export default IOperationCompressor;
