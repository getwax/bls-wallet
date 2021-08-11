import { BigNumber, Contract, BaseContract, utils } from "ethers";

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
  const encodedFunctionHash = utils.solidityKeccak256(
    ["bytes"],
    [encodedFunction],
  );

  let dataToSign = utils.solidityPack(
    ["uint256", "uint256", "uint256", "address", "bytes32"],
    [
      fullTxData.chainId,
      fullTxData.nonce,
      fullTxData.reward,
      fullTxData.contract.address,
      encodedFunctionHash,
    ],
  );
  return [
    Fixture.txDataFromFull(fullTxData),
    fullTxData.blsSigner.sign(dataToSign)
  ];
}
