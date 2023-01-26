/* eslint-disable no-process-exit */
/**
 * yarn hardhat run ./scripts/measure_gas --network network_from_hardhat_config
 */

import { ContractTransaction, ContractReceipt } from "ethers";
import { writeFile } from "fs/promises";
import { network } from "hardhat";
import { HttpNetworkConfig } from "hardhat/types";
import Web3 from "web3";
import { BlsWalletWrapper } from "../../clients/src";
import Fixture from "../../shared/helpers/Fixture";
import { sleep } from "../sleep";
import {
  normalTransferConfig,
  blsTransferConfig,
  blsExpanderAirdropConfig,
  blsExpanderAddressTransferConfig,
} from "./configs";
import { sumArbitrumMeasurements } from "./networks/arbitrum";
// TODO Format gas results into MD file
// import { processGasResultsToFile } from "./format";
import { Rng } from "./rng";
import { deployToken, distributeToken } from "./token";
import { getRawTransaction, sumTransactionSizesBytes } from "./transaction";
import {
  GasMeasurementContext,
  GasMeasurement,
  GasMeasurementConfig,
  InitialContext,
  GasMeasurementTransactionConfig,
  GasMeasurementResult,
} from "./types";

const generatePrivateKey = (rng: Rng): string => {
  const secretNum = Math.abs((rng.random() * 0xffffffff) << 0);
  return `0x${secretNum.toString(16)}`;
};

const init = async (cfg: GasMeasurementConfig): Promise<InitialContext> => {
  const rng = new Rng(cfg.seed);
  // Let first BLS Wallet measurements create wallets
  // TODO You fool, don't do this
  const fx = await Fixture.create(0);
  const [signer] = fx.signers;

  const walletPrivateKeys = Array.from(new Array(cfg.numBlsWallets), () =>
    generatePrivateKey(rng),
  );

  const blsWallets = await Promise.all(
    walletPrivateKeys.map(async (privKey) =>
      BlsWalletWrapper.connect(
        privKey,
        fx.verificationGateway.address,
        fx.provider,
      ),
    ),
  );
  const walletAddresses = blsWallets.map((w) => w.address);

  const erc20Token = await deployToken(signer, cfg.tokenSupply);
  console.log(`token deployed to ${erc20Token.address}`);
  await distributeToken(signer, erc20Token, walletAddresses);
  console.log("token distributed to BLS Wallets");

  /**
   * Web3 needs to be used over ethers.js since its transaction
   * receipts do not have the 'gasUsedForL1' property stripped out.
   */
  const { url: rpcUrl } = network.config as HttpNetworkConfig;
  if (!rpcUrl) {
    throw new Error("ethers.js network config does not have url");
  }
  const web3Provider = new Web3(rpcUrl);

  return {
    fx,
    rng,
    blsWallets,
    web3Provider,
    erc20Token,
  };
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

const maxErrStrLen = 1024;
const shortenError = (err: Error): string => {
  const errStr = err.toString();
  if (errStr.length <= maxErrStrLen) {
    return errStr;
  }
  return `${errStr.slice(0, maxErrStrLen)}...`;
};


const measureGas = async (cfg: GasMeasurementConfig): Promise<void> => {
  console.log("measuring gas for BLS Wallet contracts");

  console.log();
  console.log("config: ");
  console.log(JSON.stringify(cfg, null, 4));
  console.log();

  const initCtx = await init(cfg);

  const measurements = [];

  for (const txnCfg of cfg.transactionConfigs) {
    for (const numTxns of cfg.transactionBatches) {
      console.log(
        `next measurement in ${cfg.delayBetweenMeasurementsSeconds} seconds`,
      );
      const sleepMilliseconds = cfg.delayBetweenMeasurementsSeconds * 1000;
      await sleep(sleepMilliseconds);

      console.log(
        `running ${txnCfg.type}, mode ${txnCfg.mode}. # of transactions: ${numTxns}`,
      );

      const ctx = { ...initCtx, numTransactions: numTxns };

      try {
        const txns = await txnCfg.factoryFunc(ctx);
        console.log(`txn hashes: ${txns.map((tx) => tx.hash).join(", ")}`);
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
    measurements,
  };

  const formattedResults = JSON.stringify(result, null, 4);
  const gasMeasurementsFileName = `./gasMeasurements-${Date.now()}.json`;
  console.log(`writing gas measurements to ${gasMeasurementsFileName}`);
  await writeFile(gasMeasurementsFileName, formattedResults);

  console.log("done");
  console.log();
};

async function main() {
  const config: GasMeasurementConfig = {
    seed: "bls_wallet_measure_gas",
    numBlsWallets: 16,
    tokenSupply: 1000000,
    // Max tested limited on goerli arbitrum is 151 bls transfers.
    // transactionBatches: [50, 100, 150],
    transactionBatches: [10],
    transactionConfigs: [
      normalTransferConfig,
      blsTransferConfig,
      blsExpanderAirdropConfig,
      blsExpanderAddressTransferConfig,
    ],
    delayBetweenMeasurementsSeconds: 5,
  };

  await measureGas(config);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
