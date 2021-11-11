import { ethers } from "hardhat";
import { BlsSignerInterface } from "../lib/hubble-bls/src/signer";

import blsKeyHash from "./blsKeyHash";
import dataPayload from "./dataPayload";

import { BigNumber, Contract } from "ethers";
import { TxSet } from "./Fixture";

export default async function createBLSWallet(
  chainId: number,
  verificationGateway: Contract,
  blsSigner: BlsSignerInterface,
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
    ethValue,
    verificationGateway.address,
    encodedFunction,
  );

  const signature = blsSigner.sign(dataToSign);

  let txSet: TxSet = {
    publicKeySender: blsSigner.pubkey,
    nonce: BigNumber.from(0),
    atomic: false,
    actions: [{
      ethValue: ethValue,
      contractAddress: verificationGateway.address,
      encodedFunction: encodedFunction
      }]
  }
  await (await verificationGateway.actionCalls(
    [blsSigner.pubkey],
    signature,
    [txSet]
  )).wait();

  return (await verificationGateway.walletFromHash(blsPubKeyHash)) as string;
}

