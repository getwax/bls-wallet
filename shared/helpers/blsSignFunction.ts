import { BigNumber, Contract, BaseContract, utils } from "ethers";

import dataPayload from "./dataPayload";

import { BlsSignerInterface } from "../lib/hubble-bls/src/signer";
import { solG1 } from "../lib/hubble-bls/src/mcl"

import Fixture, { FullTxData, TxData } from "./Fixture";

export default function blsSignFunction(
  fullTxData:FullTxData
): [TxData, solG1] {
  let encodedFunction = fullTxData.contract.interface.encodeFunctionData(
    fullTxData.functionName,
    fullTxData.params
  );
  let dataToSign = dataPayload(
    fullTxData.chainId,
    fullTxData.nonce,
    fullTxData.reward,
    fullTxData.ethValue,
    fullTxData.contract.address,
    encodedFunction
  );
  return [
    Fixture.txDataFromFull(fullTxData),
    fullTxData.blsSigner.sign(dataToSign)
  ];
}
