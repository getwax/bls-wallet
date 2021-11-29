import * as hubbleBls from "../../deps/hubble-bls";

import { Bundle } from "./types";

export default (bundles: Bundle[]): Bundle => {
  return {
    users: bundles.map((b) => b.users).flat(),
    operations: bundles.map((b) => b.operations).flat(),
    signature: hubbleBls.signer.aggregate(bundles.map((b) => b.signature)),
  };
};
