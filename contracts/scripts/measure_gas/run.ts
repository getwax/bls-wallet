/* eslint-disable no-process-exit */
/**
 * yarn hardhat run ./scripts/measure_gas/run.ts --network network_from_hardhat_config
 */

import {
  normalTransferConfig,
  blsTransferConfig,
  blsExpanderAirdropConfig,
  blsExpanderAddressTransferConfig,
} from "./configs";
import { measureGas } from "./measure";
import { GasMeasurementConfig } from "./types";
// TODO Format gas results into MD file
// import { processGasResultsToFile } from "./format";

/**
 * Entrypoint to run gas script
 */
const run = async (): Promise<void> => {
  const config: GasMeasurementConfig = {
    seed: "bls_wallet_measure_gas",
    numBlsWallets: 16,
    numTokensPerWallet: 100_000,
    // Max tested limited on goerli arbitrum is 151 bls transfers.
    // transactionBatches: [50, 100, 150],
    transactionBatches: [10],
    transactionConfigs: [
      normalTransferConfig,
      blsTransferConfig,
      blsExpanderAirdropConfig,
      blsExpanderAddressTransferConfig,
    ],
  };

  await measureGas(config);
};

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
run()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
