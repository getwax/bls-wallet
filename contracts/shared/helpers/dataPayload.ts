import { BigNumber } from "ethers";
import { ethers } from "hardhat";

const { utils } = ethers;


export function dataPayloadMulti(
  chainId: number,
  nonce: number,
  ethValues: BigNumber[],
  contractAddresses: string[],
  encodedFunctions: string[],
) {
  let length = ethValues.length;
  if (
    (contractAddresses.length != length)
    || (encodedFunctions.length != length)
  ) {
    throw new Error("dataPayloadMulti: array length mismatch");
  }
  let encodedActionData = "0x";
  for (let i=0; i<length; i++) {
    encodedActionData = utils.solidityPack(
      ["bytes", "uint256", "address", "bytes32"],
      [
        encodedActionData,
        ethValues[i],
        contractAddresses[i].toString(),
        utils.solidityKeccak256(
          ["bytes"],
          [encodedFunctions[i]]
        )
      ]
    );
  }

  let encodedActionDataHash = utils.solidityKeccak256(
    ["bytes"],
    [encodedActionData]
  )

  return utils.solidityPack(
    ["uint256", "uint256", "bytes32"],
    [
      chainId,
      nonce,
      encodedActionDataHash
    ],
  );
}

/**
 * Payload for single action (TODO: multiple)
 * @param encodedFunction "0x" is expected (representing 0 bytes) for calls without a function or params, ie just sending ETH.
 * @returns 
 */
export default function dataPayload(
  chainId: number,
  nonce: number,
  ethValue: BigNumber,
  contractAddress: string,
  encodedFunction: string,
) {
  return dataPayloadMulti(
    chainId,
    nonce,
    [ethValue],
    [contractAddress],
    [encodedFunction]
  );
  let encodedActionData = utils.solidityPack(
    ["uint256", "address", "bytes32"],
    [
      ethValue,
      contractAddress.toString(),
      utils.solidityKeccak256(
        ["bytes"],
        [encodedFunction]
      )
    ]
  );

  let encodedActionDataHash = utils.solidityKeccak256(
    ["bytes"],
    [encodedActionData]
  )

  return utils.solidityPack(
    ["uint256", "uint256", "bytes32"],
    [
      chainId,
      nonce,
      encodedActionDataHash
    ],
  );
}
