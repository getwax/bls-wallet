import { solidityKeccak256 } from "ethers/lib/utils";
import { signer } from "@thehubbleproject/bls";

import getPublicKey from "./getPublicKey";

export default (signerFactory: signer.BlsSignerFactory, domain: Uint8Array) =>
  (privateKey: string): string => {
    const publicKey = getPublicKey(signerFactory, domain)(privateKey);
    return solidityKeccak256(
      ["uint256", "uint256", "uint256", "uint256"],
      publicKey,
    );
  };
