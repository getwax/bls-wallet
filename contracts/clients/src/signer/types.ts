import { BigNumberish, BytesLike } from "ethers";

export type ActionData = {
  ethValue: BigNumberish;
  contractAddress: string;
  encodedFunction: BytesLike;
};

export type Operation = {
  nonce: BigNumberish;
  gas: BigNumberish;
  actions: ActionData[];
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
  actions: ActionDataDto[];
};

export type BundleDto = {
  senderPublicKeys: [string, string, string, string][];
  operations: OperationDto[];
  signature: [string, string];
};
