import { BigNumber, Contract, BaseContract, utils } from "ethers";

import dataPayload from "./dataPayload";

import { BlsSignerInterface } from "../lib/hubble-bls/src/signer";
import { solG1 } from "../lib/hubble-bls/src/mcl"

import Fixture, { FullTxData, TxData } from "./Fixture";
import blsKeyHash from "./blsKeyHash";

export default function blsSignFunction(
  fullTxData:FullTxData
): [TxData, solG1] {
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

  let txData:TxData = {
    publicKeyHash: blsKeyHash(fullTxData.blsSigner),
    nonce: BigNumber.from(fullTxData.nonce),
    ethValue: fullTxData.ethValue,
    contractAddress: address,
    encodedFunction: encodedFunction
  };

  let dataToSign = dataPayload(
    fullTxData.chainId,
    fullTxData.nonce,
    fullTxData.ethValue,
    address,
    encodedFunction
  );

  return [
    txData,
    fullTxData.blsSigner.sign(dataToSign)
  ];
}
