import { ContractTransaction, ContractReceipt } from "ethers";
import { writeFile } from "fs/promises";
import { validateConfig } from "./config";
import { sumArbitrumMeasurements } from "./networks/arbitrum";
import { init } from "./setup";
import { getRawTransaction, sumTransactionSizesBytes } from "./transaction";
import {
  GasMeasurementContext,
  GasMeasurement,
  GasMeasurementConfig,
  GasMeasurementTransactionConfig,
  GasMeasurementResult,
} from "./types";

const maxErrStrLen = 1024;
const shortenError = (err: Error): string => {
  const errStr = err.toString();
  if (errStr.length <= maxErrStrLen) {
    return errStr;
  }
  return `${errStr.slice(0, maxErrStrLen)}...`;
};

const getMeasurements = async (
  { numTransactions, web3Provider }: GasMeasurementContext,
  { mode, type }: GasMeasurementTransactionConfig,
  txns: ContractTransaction[],
  receipts: ContractReceipt[],
): Promise<GasMeasurement> => {
  const txnHashes = receipts.map((r) => r.transactionHash);
  const arbitrum = await sumArbitrumMeasurements(web3Provider, txnHashes);

  const rawTxnsData = txns.map((t) => t.raw ?? getRawTransaction(t));
  const { used, price } = receipts.reduce(
    (acc, r) => ({
      ...acc,
      used: acc.used + r.gasUsed.toNumber(),
      price: acc.price + r.effectiveGasPrice.toNumber(),
    }),
    { used: 0, price: 0 },
  );

  return {
    transactions: {
      count: numTransactions,
      mode,
      type,
      hashes: txnHashes,
      totalSizeBytes: sumTransactionSizesBytes(rawTxnsData),
    },
    gas: {
      used,
      price,
      arbitrum,
    },
  };
};

export const measureGas = async (cfg: GasMeasurementConfig): Promise<void> => {
  console.log("measuring gas for BLS Wallet contracts");

  console.log();
  console.log("config: ");
  console.log(JSON.stringify(cfg, null, 4));
  console.log();

  validateConfig(cfg);

  const initCtx = await init(cfg);

  const measurements = [];

  for (const txnCfg of cfg.transactionConfigs) {
    for (const numTxns of cfg.transactionBatches) {
      console.log(
        `running ${txnCfg.type}, mode ${txnCfg.mode}. # of transactions: ${numTxns}`,
      );

      const ctx = { ...initCtx, numTransactions: numTxns };

      try {
        const txns = await txnCfg.factoryFunc(ctx);
        console.log(`txn hashes: [${txns.map((tx) => tx.hash).join(", ")}]`);
        const receipts = await Promise.all(txns.map(async (tx) => tx.wait()));
        console.log("transaction complete");

        const m = await getMeasurements(ctx, txnCfg, txns, receipts);
        measurements.push(m);
        console.log("measurement complete");
      } catch (err) {
        console.error(err);

        measurements.push({
          numTransactions: numTxns,
          transaction: {
            type: txnCfg.type,
            mode: txnCfg.mode,
          },
          error: shortenError(err),
        });

        continue;
      }
    }
  }

  console.log("all gas measuements complete");

  const result: GasMeasurementResult = {
    config: cfg,
    eoaSignerAddress: await initCtx.eoaSigner.getAddress(),
    blsWalletAddresses: initCtx.blsWallets.map((w) => w.address),
    measurements,
  };

  const formattedResults = JSON.stringify(result, null, 4);
  const gasMeasurementsFileName = `./gasMeasurements-${Date.now()}.json`;
  console.log(`writing gas measurements to ${gasMeasurementsFileName}`);
  await writeFile(gasMeasurementsFileName, formattedResults);

  console.log("done");
  console.log();
};
