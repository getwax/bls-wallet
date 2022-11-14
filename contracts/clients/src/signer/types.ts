import { BigNumberish } from "ethers";

export type ActionData = {
  ethValue: BigNumberish;
  contractAddress: string;
  encodedFunction: string;
};

export type Operation = {
  nonce: BigNumberish;
  gasLimit: BigNumberish;
  actions: ActionData[];
};

export type OperationInput = Omit<Operation, "gasLimit"> & {
  gasLimit?: BigNumberish;
};

export type Bundle = {
  signature: [BigNumberish, BigNumberish];
  senderPublicKeys: [BigNumberish, BigNumberish, BigNumberish, BigNumberish][];
  operations: Operation[];
};

export type PublicKey = Bundle["senderPublicKeys"][number];
export type Signature = Bundle["signature"];

export type ActionDataDto = {
  ethValue: string;
  contractAddress: string;
  encodedFunction: string;
};

export type OperationDto = {
  nonce: string;
  gasLimit: string;
  actions: ActionDataDto[];
};

export type BundleDto = {
  senderPublicKeys: [string, string, string, string][];
  operations: OperationDto[];
  signature: [string, string];
};
