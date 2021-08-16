import { BigNumber } from "@ethersproject/bignumber";

export type RawTransactionData = {
  contractAddress: string;
  encodedFunctionData: string;
  nonce: BigNumber;
  tokenRewardAmount: BigNumber;
};

export type TransactionData = RawTransactionData & {
  publicKey: string;
  signature: string;
};
