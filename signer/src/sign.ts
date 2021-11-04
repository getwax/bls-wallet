import * as hubbleBls from "../deps/hubble-bls";

import encodeMessageForSigning from "./encodeMessageForSigning";
import getPublicKey from "./getPublicKey";
import { TransactionSet, TransactionTemplate } from "./types";

export default (
  signerFactory: hubbleBls.signer.BlsSignerFactory,
  domain: Uint8Array,
  chainId: number,
) => (
  txTemplate: TransactionTemplate,
  privateKey: string,
): TransactionSet => {
  const message = encodeMessageForSigning(chainId)(txTemplate);
  const signer = signerFactory.getSigner(domain, privateKey);

  const signature = hubbleBls.mcl.dumpG1(signer.sign(message));

  return {
    transactions: [
      {
        ...txTemplate,
        publicKey: getPublicKey(signerFactory, domain)(privateKey),
      }
    ],
    signature,
  }
};
