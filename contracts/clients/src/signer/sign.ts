import { signer } from "@thehubbleproject/bls";
import { solidityKeccak256 } from "ethers/lib/utils";

import encodeMessageForSigning from "./encodeMessageForSigning";
import { Bundle, Operation } from "./types";

export default (
    signerFactory: signer.BlsSignerFactory,
    domain: Uint8Array,
    chainId: number,
  ) =>
  (operation: Operation, privateKey: string): Bundle => {
    const signer = signerFactory.getSigner(domain, privateKey);
    const message = encodeMessageForSigning(
      chainId,
      solidityKeccak256(
        ["uint256", "uint256", "uint256", "uint256"],
        signer.pubkey,
      ),
    )(operation);

    const signature = signer.sign(message);

    return {
      senderPublicKeys: [signer.pubkey],
      operations: [operation],
      signature,
    };
  };
