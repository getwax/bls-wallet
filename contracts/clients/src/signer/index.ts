import { signer } from "../../deps/hubble-bls";

import aggregate from "./aggregate";
import defaultDomain from "./defaultDomain";
import getPublicKey from "./getPublicKey";
import getPublicKeyHash from "./getPublicKeyHash";
import getPublicKeyStr from "./getPublicKeyStr";
import AsyncReturnType from "./helpers/AsyncReturnType";
import sign from "./sign";
import verify from "./verify";

export * from "./types";
export * from "./conversions";

export type BlsWalletSigner = AsyncReturnType<typeof initBlsWalletSigner>;

export async function initBlsWalletSigner({
  domain = defaultDomain,
  chainId,
}: {
  domain?: Uint8Array;
  chainId: number;
}) {
  // Note: Getting signers via this factory ensures that mcl-wasm's underlying
  // init() has been called when signing. However, other operations such as
  // signature verification probably also require this initialization, but have
  // no similar factory. By guarding access to bls-wallet-signer's apis behind
  // the creation of the signer factory, we're ensuring that mcl-wasm is
  // properly initialized for all use cases, not just signing.
  const signerFactory = await signer.BlsSignerFactory.new();

  return {
    aggregate,
    getPublicKey: getPublicKey(signerFactory, domain),
    getPublicKeyHash: getPublicKeyHash(signerFactory, domain),
    getPublicKeyStr: getPublicKeyStr(signerFactory, domain),
    sign: sign(signerFactory, domain, chainId),
    verify: verify(domain, chainId),
  };
}
