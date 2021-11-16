import { BigNumber } from "@ethersproject/bignumber";

export type ActionData = {
  ethValue: BigNumber;
  contractAddress: string;
  encodedFunction: string;
};

export type TransactionTemplate = {
  nonce: BigNumber;
  atomic: boolean;
  actions: ActionData[];
};

export type SubTransaction = TransactionTemplate & { publicKey: string };

export type Transaction = {
  subTransactions: SubTransaction[];
  signature: string;
};
