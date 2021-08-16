import * as hubbleBls from "../deps/hubble-bls";
import domain from "./domain";
import encodeMessageForSigning from "./encodeMessageForSigning";
import getPublicKey from "./getPublicKey";
import { RawTransactionData, TransactionData } from "./types";

export default function sign(
  chainId: number,
  rawTransactionData: RawTransactionData,
  privateKey: string,
): TransactionData {
  const message = encodeMessageForSigning(chainId, rawTransactionData);

  const blsSigner = new hubbleBls.signer.BlsSigner(domain, privateKey);
  const signature = hubbleBls.mcl.dumpG1(blsSigner.sign(message));

  return {
    ...rawTransactionData,
    publicKey: getPublicKey(privateKey),
    signature,
  }
}
