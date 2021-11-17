import { BigNumber, Contract, BaseContract, utils } from "ethers";

import dataPayload from "./dataPayload";

import { BlsSignerInterface } from "../lib/hubble-bls/src/signer";
import { solG1, solG2 } from "../lib/hubble-bls/src/mcl"

import Fixture, { FullTxData, TxSet, ActionData } from "./Fixture";
import blsKeyHash from "./blsKeyHash";

/**
 * Sign single action data. TODO: multiple actions
 * @param fullTxData 
 * @returns 
 */
export default function blsSignFunction(
  fullTxData:FullTxData
): [TxSet, solG1] {
  let encodedFunction = "0x"; // empty bytes if sending ETH only
  let address:string;
  if (fullTxData.functionName !== "") {
    encodedFunction = (fullTxData.contract as Contract).interface.encodeFunctionData(
      fullTxData.functionName,
      fullTxData.params
    );
    address = (fullTxData.contract as Contract).address;
  }
  else {
    address = fullTxData.contract as string;
  }

  let actionData: ActionData = {
    ethValue: fullTxData.ethValue,
    contractAddress: address,
    encodedFunction: encodedFunction
  };
  let txSet:TxSet = {
    publicKeySender: fullTxData.blsSigner.pubkey,
    nonce: BigNumber.from(fullTxData.nonce),
    atomic: false,
    actions: [actionData]
  };

  let dataToSign = dataPayload(
    fullTxData.chainId,
    fullTxData.nonce,
    fullTxData.ethValue,
    address,
    encodedFunction
  );

  return [
    txSet,
    fullTxData.blsSigner.sign(dataToSign)
  ];
}
