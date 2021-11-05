import { BigNumber } from "@ethersproject/bignumber";

export type RawTransactionData = {
  nonce: BigNumber;
  ethValue: BigNumber;
  contractAddress: string;
  encodedFunction: string;
};

export type TransactionData = RawTransactionData & {
  publicKey: string;
  signature: string;
};

export type AggregateTransactionData = {
  transactions: {
    publicKey: string;
    nonce: BigNumber;
    ethValue: BigNumber;
    contractAddress: string;
    encodedFunction: string;
  }[],
  signature: string,
};
