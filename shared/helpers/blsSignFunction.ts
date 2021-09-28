import { BigNumber, Contract, BaseContract, utils } from "ethers";

import dataPayload from "./dataPayload";

import { BlsSignerInterface } from "../lib/hubble-bls/src/signer";
import { solG1 } from "../lib/hubble-bls/src/mcl"

import Fixture, { FullTxData, TxDataCall, TxDataSend, zeroAddress } from "./Fixture";

export default function blsSignFunction(
  fullTxData:FullTxData,
  address=""
): [TxDataCall|TxDataSend, solG1] {
  let encodedFunction = "";
  if (fullTxData.functionName !== "") {
    encodedFunction = fullTxData.contract.interface.encodeFunctionData(
      fullTxData.functionName,
      fullTxData.params
    );
  }
  let txDataSend = Fixture.txDataFromFull(fullTxData) as TxDataSend;
  if (address === "") {
    address = fullTxData.contract.address;
  }
  else {
    txDataSend.recipientAddress = address;
  }
  let dataToSign = dataPayload(
    fullTxData.chainId,
    fullTxData.nonce,
    zeroAddress,
    fullTxData.reward,
    fullTxData.ethValue,
    address,
    encodedFunction
  );
  return [
    txDataSend,
    fullTxData.blsSigner.sign(dataToSign)
  ];
}
