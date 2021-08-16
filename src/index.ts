import { mcl } from "../deps/hubble-bls";

import getPublicKey from "./getPublicKey";
import sign from "./sign";

export * from "./types";

export default async function init() {
  await mcl.init();
  
  return {
    sign,
    getPublicKey,
  };
}
