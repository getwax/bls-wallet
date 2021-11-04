import { BigNumber } from "@ethersproject/bignumber";

export type TransactionTemplate = {
  nonce: BigNumber;
  ethValue: BigNumber;
  contractAddress: string;
  encodedFunction: string;
};

export type UnsignedTransaction = TransactionTemplate & { publicKey: string };

export type TransactionSet = {
  transactions: UnsignedTransaction[],
  signature: string,
};
