import * as hubbleBls from "../../deps/hubble-bls";

import encodeMessageForSigning from "./encodeMessageForSigning";
import getPublicKey from "./getPublicKey";
import { Transaction, TransactionTemplate } from "./types";

export default (
    signerFactory: hubbleBls.signer.BlsSignerFactory,
    domain: Uint8Array,
    chainId: number,
  ) =>
  (txTemplate: TransactionTemplate, privateKey: string): Transaction => {
    const message = encodeMessageForSigning(chainId)(txTemplate);
    const signer = signerFactory.getSigner(domain, privateKey);

    const signature = hubbleBls.mcl.dumpG1(signer.sign(message));

    return {
      subTransactions: [
        {
          ...txTemplate,
          publicKey: getPublicKey(signerFactory, domain)(privateKey),
        },
      ],
      signature,
    };
  };
