import { mcl } from "../deps/hubble-bls";

import aggregate from "./aggregate";
import getPublicKey from "./getPublicKey";
import sign from "./sign";
import verify from "./verify";

export * from "./types";

export default async function init() {
  await mcl.init();

  return {
    aggregate,
    getPublicKey,
    sign,
    verify,
  };
}
