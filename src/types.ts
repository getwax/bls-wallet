import { BigNumber } from "@ethersproject/bignumber";

export type RawTransactionData = {
  nonce: BigNumber;
  tokenRewardAmount: BigNumber;
  ethValue: BigNumber;
  contractAddress: string;
  encodedFunctionData: string;
};

export type TransactionData = RawTransactionData & {
  publicKey: string;
  signature: string;
};

export type AggregateTransactionData = {
  transactions: {
    publicKey: string;
    nonce: BigNumber;
    tokenRewardAmount: BigNumber;
    ethValue: BigNumber;
    contractAddress: string;
    encodedFunctionData: string;
  }[],
  signature: string,
};
