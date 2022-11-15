import { signer } from "@thehubbleproject/bls";

import encodeMessageForSigning from "./encodeMessageForSigning";
import { Bundle, OperationInput } from "./types";

export default (
    signerFactory: signer.BlsSignerFactory,
    domain: Uint8Array,
    chainId: number,
  ) =>
  (
    operationInput: OperationInput,
    privateKey: string,
    walletAddress: string,
  ): Bundle => {
    const operation = {
      ...operationInput,
      gasLimit: operationInput.gasLimit ?? 0,
    };

    const signer = signerFactory.getSigner(domain, privateKey);
    const message = encodeMessageForSigning(chainId)(operation, walletAddress);
    const signature = signer.sign(message);

    return {
      senderPublicKeys: [signer.pubkey],
      operations: [operation],
      signature,
    };
  };
