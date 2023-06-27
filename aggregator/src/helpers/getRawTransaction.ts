import { ethers, pick } from "../../deps.ts";
import assert from "./assert.ts";
import nil from "./nil.ts";

export default async function getRawTransaction(
  provider: ethers.providers.Provider,
  txResponseOrHash: string | ethers.providers.TransactionResponse,
) {
  const tx = typeof txResponseOrHash === "string"
    ? await provider.getTransaction(txResponseOrHash)
    : txResponseOrHash;

  const txHash = typeof txResponseOrHash === "string"
    ? txResponseOrHash
    : tx.hash;

  assert(typeof txHash === "string");

  const { v, r, s } = tx;
  assert(r !== nil);

  const txBytes = ethers.utils.serializeTransaction(
    pick(
      tx,
      "to",
      "nonce",
      "gasLimit",
      ...(tx.type === 2 ? [] : ["gasPrice"] as const),
      "data",
      "value",
      "chainId",
      "type",
      ...(tx.type !== 2 ? [] : [
        "accessList",
        "maxPriorityFeePerGas",
        "maxFeePerGas",
      ] as const),
    ),
    { v, r, s },
  );

  const reconstructedHash = ethers.utils.keccak256(txBytes);

  if (reconstructedHash !== txHash) {
    throw new Error("Reconstructed hash did not match original hash");
  }

  return txBytes;
}
