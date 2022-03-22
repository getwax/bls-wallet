import { signer } from "@thehubbleproject/bls";
import { BigNumber } from "ethers";

import type { Bundle } from "./types";
import isValidEmptyBundle from "./isValidEmptyBundle";

export default (bundles: Bundle[]): Bundle => {
  // hubbleBls.signer.aggregate incorrectly fails when passed zeros
  // (`err _wrapInput`). Here we workaround this by proactively excluding valid
  // empty bundles.
  const nonEmptyBundles = bundles.filter((b) => !isValidEmptyBundle(b));

  return {
    senderPublicKeys: nonEmptyBundles.map((b) => b.senderPublicKeys).flat(),
    operations: nonEmptyBundles.map((b) => b.operations).flat(),
    signature: signer.aggregate(
      nonEmptyBundles.map((b) => [
        BigNumber.from(b.signature[0]).toHexString(),
        BigNumber.from(b.signature[1]).toHexString(),
      ]),
    ),
  };
};
