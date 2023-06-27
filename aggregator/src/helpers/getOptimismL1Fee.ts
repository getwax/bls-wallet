import { BigNumber, ethers } from "../../deps.ts";
import OptimismGasPriceOracle from "../app/OptimismGasPriceOracle.ts";
import assert from "./assert.ts";
import getRawTransaction from "./getRawTransaction.ts";
import hexToUint8Array from "./hexToUint8Array.ts";
import nil from "./nil.ts";

export default async function getOptimismL1Fee(
  provider: ethers.providers.Provider,
  txResponseOrHash: string | ethers.providers.TransactionResponse,
) {
  const tx = typeof txResponseOrHash === "string"
    ? await provider.getTransaction(txResponseOrHash)
    : txResponseOrHash;

  const rawTx = await getRawTransaction(provider, tx);

  let l1Gas = 0;

  for (const byte of hexToUint8Array(rawTx)) {
    if (byte === 0) {
      l1Gas += 4;
    } else {
      l1Gas += 16;
    }
  }

  const gasOracle = new OptimismGasPriceOracle(provider);

  assert(tx.blockNumber !== nil);

  const {
    l1BaseFee,
    overhead,
    scalar,
    decimals,
  } = await gasOracle.getAllParams(tx.blockNumber);

  l1Gas = l1Gas += overhead.toNumber();

  const l1Fee = BigNumber
    .from(l1Gas)
    .mul(l1BaseFee)
    .mul(scalar)
    .div(
      BigNumber.from(10).pow(decimals),
    );

  return l1Fee;
}
