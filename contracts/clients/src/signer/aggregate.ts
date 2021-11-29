import { BigNumber } from "ethers";
import * as hubbleBls from "../../deps/hubble-bls";

import { Bundle } from "./types";

export default (bundles: Bundle[]): Bundle => {
  return {
    senderPublicKeys: bundles.map((b) => b.senderPublicKeys).flat(),
    operations: bundles.map((b) => b.operations).flat(),
    signature: hubbleBls.signer.aggregate(
      bundles.map((b) => [
        BigNumber.from(b.signature[0]).toHexString(),
        BigNumber.from(b.signature[1]).toHexString(),
      ]),
    ),
  };
};
