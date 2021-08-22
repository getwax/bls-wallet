import { mcl } from "../deps/hubble-bls";

import aggregate from "./aggregate";
import defaultDomain from "./defaultDomain";
import getPublicKey from "./getPublicKey";
import getPublicKeyHash from "./getPublicKeyHash";
import AsyncReturnType from "./helpers/AsyncReturnType";
import sign from "./sign";
import verify from "./verify";
import verifyAggregate from "./verifyAggregate";

export * from "./types";

export type BlsWalletSigner = AsyncReturnType<typeof initBlsWalletSigner>;

export async function initBlsWalletSigner({
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
    getPublicKeyHash: getPublicKeyHash(domain),
    sign: sign(domain, chainId),
    verify: verify(domain, chainId),
    verifyAggregate: verifyAggregate(domain, chainId),
  };
}
