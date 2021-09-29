import { ethers } from "hardhat";
import { BlsSignerInterface } from "../lib/hubble-bls/src/signer";

import blsKeyHash from "./blsKeyHash";
import dataPayload from "./dataPayload";

import { BigNumber, Contract } from "ethers";

export default async function createBLSWallet(
  chainId: number,
  verificationGateway: Contract,
  blsSigner: BlsSignerInterface,
  rewardRecipient: string,
  rewardTokenAddress: string,
  rewardTokenAmount: BigNumber = BigNumber.from(0),
  ethValue: BigNumber = BigNumber.from(0)
): Promise<string> {
  const blsPubKeyHash = blsKeyHash(blsSigner);

  const existingAddress: string = await verificationGateway.walletFromHash(
    blsPubKeyHash,
  );

  if (existingAddress !== ethers.constants.AddressZero) {
    return existingAddress;
  }

  const encodedFunction = verificationGateway.interface.encodeFunctionData(
    "walletCrossCheck",
    [blsPubKeyHash],
  );

  const dataToSign = await dataPayload(
    chainId,
    0, // initial nonce
    rewardTokenAddress,
    rewardTokenAmount,
    ethValue,
    verificationGateway.address,
    encodedFunction,
  );

  const signature = blsSigner.sign(dataToSign);

  // // can be called by any ecdsa wallet
  // await (await verificationGateway.blsCallCreate(
  //   blsSigner.pubkey,
  //   signature,
  //   reward,
  //   ethValue,
  //   verificationGateway.address,
  //   encodedFunction.substring(0, 10),
  //   "0x" + encodedFunction.substr(10),
  // )).wait();
  // can be called by any ecdsa wallet

  let data: TxDataCallNew = {
    publicKeyHash: blsKeyHash(blsSigner),
    nonce: BigNumber.from(0),
    rewardTokenAddress: rewardTokenAddress,
    rewardTokenAmount: rewardTokenAmount,
    ethValue: ethValue,
    contractAddress: verificationGateway.address,
    encodedFunction: encodedFunction
  }
  await (await verificationGateway.actionCalls(
    rewardRecipient,
    [blsSigner.pubkey],
    signature,
    [data]
  )).wait();

  return await verificationGateway.walletFromHash(blsPubKeyHash);
}

type TxDataCallNew = {
  publicKeyHash: any;
  nonce: BigNumber;
  rewardTokenAddress: string;
  rewardTokenAmount: BigNumber;
  ethValue: BigNumber;
  contractAddress: string;
  encodedFunction: string;
}
