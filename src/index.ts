import { mcl } from "../deps/hubble-bls";

import aggregate from "./aggregate";
import defaultDomain from "./defaultDomain";
import getPublicKey from "./getPublicKey";
import sign from "./sign";
import verify from "./verify";

export * from "./types";

export default async function init({
  domain = defaultDomain,
  chainId,
}: {
  domain?: Uint8Array;
  chainId: number;
}) {
  await mcl.init();

  return {
    aggregate,
    getPublicKey: getPublicKey(domain),
    sign: sign(domain, chainId),
    verify: verify(domain, chainId),
  };
}
