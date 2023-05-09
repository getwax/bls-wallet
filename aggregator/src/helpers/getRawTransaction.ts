import { ethers, pick } from "../../deps.ts";

export default async function getRawTransaction(
  provider: ethers.providers.Provider,
  txHash: string,
) {
  const txResponse = await provider.getTransaction(txHash);

  const txBytes = ethers.utils.serializeTransaction(
    pick(
      txResponse,
      "to",
      "nonce",
      "gasLimit",
      ...(txResponse.type === 2 ? [] : ["gasPrice"] as const),
      "data",
      "value",
      "chainId",
      "type",
      ...(txResponse.type !== 2 ? [] : [
        "accessList",
        "maxPriorityFeePerGas",
        "maxFeePerGas",
      ] as const),
    ),
    pick(
      txResponse,
      "v",
      "r",
      "s",
    ) as { v: number; r: string; s: string },
  );

  const reconstructedHash = ethers.utils.keccak256(txBytes);

  if (reconstructedHash !== txHash) {
    throw new Error("Reconstructed hash did not match original hash");
  }

  return txBytes;
}
