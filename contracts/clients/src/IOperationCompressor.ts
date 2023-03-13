import { Operation, PublicKey } from "./signer";

type IOperationCompressor = {
  compress(blsPublicKey: PublicKey, operation: Operation): string | undefined;
};

export default IOperationCompressor;
