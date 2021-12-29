import { solidityKeccak256 } from "ethers/lib/utils";
import { BlsSignerFactory } from "../../deps/hubble-bls/signer";

import getPublicKey from "./getPublicKey";

export default (signerFactory: BlsSignerFactory, domain: Uint8Array) =>
  (privateKey: string): string => {
    const publicKey = getPublicKey(signerFactory, domain)(privateKey);
    return solidityKeccak256(
      ["uint256", "uint256", "uint256", "uint256"],
      publicKey,
    );
  };
