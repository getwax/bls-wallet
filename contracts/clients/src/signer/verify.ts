import { signer } from "@thehubbleproject/bls";
import { BigNumber } from "ethers";

import encodeMessageForSigning from "./encodeMessageForSigning";
import type { Bundle } from "./types";
import isValidEmptyBundle from "./isValidEmptyBundle";

export default (domain: Uint8Array, chainId: number) =>
  (bundle: Bundle, walletAddress: string): boolean => {
    // hubbleBls verifier incorrectly rejects empty bundles
    if (isValidEmptyBundle(bundle)) {
      return true;
    }

    const verifier = new signer.BlsVerifier(domain);

    return verifier.verifyMultiple(
      [
        BigNumber.from(bundle.signature[0]).toHexString(),
        BigNumber.from(bundle.signature[1]).toHexString(),
      ],
      bundle.senderPublicKeys.map(([n0, n1, n2, n3]) => [
        BigNumber.from(n0).toHexString(),
        BigNumber.from(n1).toHexString(),
        BigNumber.from(n2).toHexString(),
        BigNumber.from(n3).toHexString(),
      ]),
      bundle.operations.map((op) =>
        encodeMessageForSigning(chainId)(op, walletAddress),
      ),
    );
  };
