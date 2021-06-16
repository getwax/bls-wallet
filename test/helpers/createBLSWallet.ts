import { ethers, hubbleBls } from "../../deps/index.ts";

import blsKeyHash from "./blsKeyHash.ts";
import dataPayload from "./dataPayload.ts";

type BlsSignerInterface = hubbleBls.signer.BlsSignerInterface;

export default async function createBLSWallet(
  chainId: number,
  verificationGateway: ethers.Contract,
  blsSigner: BlsSignerInterface,
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
    0,
    0,
    verificationGateway.address,
    encodedFunction,
  );

  const signature = blsSigner.sign(dataToSign);

  // can be called by any ecdsa wallet
  await (await verificationGateway.blsCallCreate(
    blsSigner.pubkey,
    signature,
    ethers.BigNumber.from(0),
    verificationGateway.address,
    encodedFunction.substring(0, 10),
    "0x" + encodedFunction.substr(10),
  )).wait();

  return await verificationGateway.walletFromHash(blsPubKeyHash);
}
