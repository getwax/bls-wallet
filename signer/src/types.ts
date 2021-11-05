import { BigNumber } from "@ethersproject/bignumber";

export type TransactionTemplate = {
  nonce: BigNumber;
  ethValue: BigNumber;
  contractAddress: string;
  encodedFunction: string;
};

export type SubTransaction = TransactionTemplate & { publicKey: string };

export type Transaction = {
  subTransactions: SubTransaction[],
  signature: string,
};
