import { BigNumber, Contract, BaseContract, utils } from "ethers";

import { BlsSignerInterface } from "../lib/hubble-bls/src/signer";
import { solG1 } from "../lib/hubble-bls/src/mcl"

import dataPayload from "./dataPayload";
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

// export default function blsSignTransfer(
//   blsSigner: BlsSignerInterface,
//   chainId: number,
//   nonce: number,
//   token: Contract,
//   recipientAddress: string,
//   amount: BigNumber
// ): [string, solG1] {
//   let encodedTransfer = token.interface.encodeFunctionData(
//     "transfer",
//     [recipientAddress, amount.toString()]
//   );
//   let dataToSign = dataPayload(
//     chainId,
//     nonce,
//     BigNumber.from(0),
//     token.address,
//     encodedTransfer
//   );
//   return [encodedTransfer, blsSigner.sign(dataToSign)];
// }
