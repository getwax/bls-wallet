import { ethers } from "hardhat";
import { BlsSignerInterface } from "../lib/hubble-bls/src/signer";

import blsKeyHash from "./blsKeyHash";
import dataPayload from "./dataPayload";

import { BigNumber, Contract } from "ethers";

export default async function createBLSWallet(
  chainId: number,
  verificationGateway: Contract,
  blsSigner: BlsSignerInterface,
  reward: BigNumber = BigNumber.from(0)
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
    reward,
    verificationGateway.address,
    encodedFunction,
  );

  const signature = blsSigner.sign(dataToSign);

  // can be called by any ecdsa wallet
  await (await verificationGateway.blsCallCreate(
    blsSigner.pubkey,
    signature,
    reward,
    verificationGateway.address,
    encodedFunction.substring(0, 10),
    "0x" + encodedFunction.substr(10),
  )).wait();

  return await verificationGateway.walletFromHash(blsPubKeyHash);
}
