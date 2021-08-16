import { keccak256 } from "@ethersproject/keccak256";
import { pack as solidityPack } from "@ethersproject/solidity";

import * as hubbleBls from "../deps/hubble-bls";
import domain from "./domain";
import getPublicKey from "./getPublicKey";
import { RawTransactionData, TransactionData } from "./types";

export default function sign(
  chainId: number,
  rawTransactionData: RawTransactionData,
  privateKey: string,
): TransactionData {
  const encodedFunctionHash = keccak256(solidityPack(
    ["bytes"],
    [rawTransactionData.encodedFunctionData],
  ));

  const message = solidityPack(
    ["uint256", "uint256", "uint256", "address", "bytes32"],
    [
      chainId,
      rawTransactionData.nonce,
      rawTransactionData.tokenRewardAmount,
      rawTransactionData.contractAddress,
      encodedFunctionHash,
    ]
  );

  const blsSigner = new hubbleBls.signer.BlsSigner(domain, privateKey);
  const signature = hubbleBls.mcl.dumpG1(blsSigner.sign(message));

  return {
    ...rawTransactionData,
    publicKey: getPublicKey(privateKey),
    signature,
  }
}
