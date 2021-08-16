import type { BigNumber } from "@ethersproject/bignumber";
import { arrayify } from "@ethersproject/bytes";
import { keccak256 } from "@ethersproject/keccak256";
import { pack as solidityPack } from "@ethersproject/solidity";

export const BLS_DOMAIN = arrayify(keccak256("0xfeedbee5"));

export type TransactionData = {
  pubKey: string;
  nonce: number;
  signature: string;
  tokenRewardAmount: string;
  contractAddress: string;
  methodId: string;
  encodedParams: string;
};

export default function sign({
  chainId,
  contractAddress,
  encodedFunctionData,
  tokenRewardAmount,
  nonce,
  blsPrivateKey,
}: {
  chainId: number,
  contractAddress: string;
  encodedFunctionData: string;
  tokenRewardAmount: BigNumber;
  nonce: BigNumber;
  blsPrivateKey: string;
}): TransactionData {
  const encodedFunctionHash = keccak256(solidityPack(
    ["bytes"],
    [encodedFunctionData],
  ));

  const message = solidityPack(
    ["uint256", "uint256", "uint256", "address", "bytes32"],
    [
      chainId,
      nonce,
      tokenRewardAmount,
      contractAddress,
      encodedFunctionHash,
    ]
  );

  const signature = this.blsSigner.sign(message);

  let tokenRewardAmountStr = tokenRewardAmount.toHexString();

  tokenRewardAmountStr = `0x${
    tokenRewardAmountStr.slice(2).padStart(64, "0")
  }`;

  return {
    pubKey: hubbleBls.mcl.dumpG2(this.blsSigner.pubkey),
    nonce,
    signature: hubbleBls.mcl.dumpG1(signature),
    tokenRewardAmount: tokenRewardAmountStr,
    contractAddress: contract.address,
    methodId: encodedFunction.slice(0, 10),
    encodedParams: `0x${encodedFunction.slice(10)}`,
  };
}
