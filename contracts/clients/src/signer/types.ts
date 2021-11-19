import { BigNumber } from "@ethersproject/bignumber";
import { solG1, solG2 } from "../../deps/hubble-bls/mcl";

export type PublicKey = solG2;
export type Signature = solG1;

export type ActionData = {
  ethValue: BigNumber;
  contractAddress: string;
  encodedFunction: string;
};

export type Operation = {
  nonce: BigNumber;
  atomic: boolean;
  actions: ActionData[];
};

export type Bundle = {
  users: PublicKey[];
  operations: Operation[];
  signature: Signature;
};
