import { BigNumberish, BigNumber } from "ethers";
import Web3 from "web3";
import { ArbitrumGasMeasurement } from "../types";

/**
 * Gets arbitrum specific gas measurements.
 * See https://developer.arbitrum.io/sdk/interfaces/dataEntities_rpc.ArbTransactionReceipt#gasusedforl1
 *
 * @param web3Provider web3.js provider. This must be used over ethers.js to get custom arbitrum receipt values
 * @param txnHash transaction hash
 * @returns arbitrum specific gas measurements
 */
export const getArbitrumMeasurements = async (
  web3Provider: Web3,
  txnHash: string,
): Promise<ArbitrumGasMeasurement | undefined> => {
  const web3Receipt = await web3Provider.eth.getTransactionReceipt(txnHash);
  const { gasUsedForL1 } = web3Receipt as unknown as {
    gasUsedForL1?: BigNumberish;
  };
  if (!gasUsedForL1) {
    return undefined;
  }
  return { gasUsedForL1: BigNumber.from(gasUsedForL1).toNumber() };
};

export const getManyArbitrumMeasurements = async (
  web3Provider: Web3,
  txnHashes: string[],
): Promise<Array<ArbitrumGasMeasurement | undefined>> => {
  return Promise.all(
    txnHashes.map(async (h) => getArbitrumMeasurements(web3Provider, h)),
  );
};

export const sumArbitrumMeasurements = async (
  web3Provider: Web3,
  txnHashes: string[],
): Promise<ArbitrumGasMeasurement | undefined> => {
  const arbMeasurements = await getManyArbitrumMeasurements(
    web3Provider,
    txnHashes,
  );
  const hasArbMeasurements = !!arbMeasurements.filter((m) => !!m).length;
  if (!hasArbMeasurements) {
    return undefined;
  }

  return arbMeasurements.reduce(
    (m, cur) => ({
      ...m,
      gasUsedForL1: m.gasUsedForL1 + (cur?.gasUsedForL1 ?? 0),
    }),
    { gasUsedForL1: 0 },
  );
};
