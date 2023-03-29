import { signer } from "@thehubbleproject/bls";

import aggregate from "./aggregate";
import getDomain from "./getDomain";
import getPublicKey from "./getPublicKey";
import getPublicKeyHash from "./getPublicKeyHash";
import getPublicKeyStr from "./getPublicKeyStr";
import AsyncReturnType from "./helpers/AsyncReturnType";
import sign from "./sign";
import signMessage from "./signMessage";
import verify from "./verify";

export * from "./types";
export * from "./conversions";

export type BlsWalletSigner = AsyncReturnType<typeof initBlsWalletSigner>;

export async function initBlsWalletSigner({
  chainId,
  verificationGatewayAddress,
}: {
  chainId: number;
  verificationGatewayAddress: string;
}) {
  // Note: Getting signers via this factory ensures that mcl-wasm's underlying
  // init() has been called when signing. However, other operations such as
  // signature verification probably also require this initialization, but have
  // no similar factory. By guarding access to bls-wallet-signer's apis behind
  // the creation of the signer factory, we're ensuring that mcl-wasm is
  // properly initialized for all use cases, not just signing.
  const signerFactory = await signer.BlsSignerFactory.new();

  const bundleDomain = getDomain(chainId, verificationGatewayAddress, "Bundle");
  const walletDomain = getDomain(chainId, verificationGatewayAddress, "Wallet");

  return {
    aggregate,
    getPublicKey: getPublicKey(signerFactory, bundleDomain),
    getPublicKeyHash: getPublicKeyHash(signerFactory, bundleDomain),
    getPublicKeyStr: getPublicKeyStr(signerFactory, bundleDomain),
    sign: sign(signerFactory, bundleDomain, chainId),
    signMessage: signMessage(signerFactory, walletDomain),
    verify: verify(bundleDomain, chainId),
  };
}
