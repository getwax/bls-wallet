import { ethers } from "../../deps.ts";

export default async function receiptOf(
  responsePromise: Promise<ethers.providers.TransactionResponse>,
): Promise<ethers.providers.TransactionReceipt> {
  const response = await responsePromise;
  const receipt = await response.wait();

  return receipt;
}
