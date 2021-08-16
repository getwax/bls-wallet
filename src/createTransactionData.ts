import type { BigNumber } from "@ethersproject/bignumber";
import { arrayify } from "@ethersproject/bytes";
import { keccak256 } from "@ethersproject/keccak256";

import * as hubbleBls from "../deps/hubble-bls";
import sign from "./sign";

export const BLS_DOMAIN = arrayify(keccak256("0xfeedbee5"));

export type TransactionData = {
  pubKey: string;
  nonce: BigNumber;
  signature: string;
  tokenRewardAmount: BigNumber;
  contractAddress: string;
  methodId: string;
  encodedParams: string;
};

export default function createTransactionData({
  blsSignerFactory,
  chainId,
  contractAddress,
  encodedFunctionData,
  tokenRewardAmount,
  nonce,
  blsPrivateKey,
}: {
  blsSignerFactory: hubbleBls.signer.BlsSignerFactory;
  chainId: number;
  contractAddress: string;
  encodedFunctionData: string;
  tokenRewardAmount: BigNumber;
  nonce: BigNumber;
  blsPrivateKey: string;
}): TransactionData {
  const signature = sign({
    blsSignerFactory,
    chainId,
    contractAddress,
    encodedFunctionData,
    tokenRewardAmount,
    nonce,
    blsPrivateKey,
  });

  return {
    pubKey: hubbleBls.mcl.dumpG2(
      blsSignerFactory.getSigner(BLS_DOMAIN, blsPrivateKey).pubkey
    ),
    nonce,
    signature,
    tokenRewardAmount,
    contractAddress: contractAddress,
    methodId: encodedFunctionData.slice(0, 10),
    encodedParams: `0x${encodedFunctionData.slice(10)}`,
  };
}
