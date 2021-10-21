import * as t from "io-ts";
import { PathReporter } from "io-ts/PathReporter";

const NetworkConfigType = t.readonly(
  t.type({
    /**
     * Parameters used in contract deployment. Currently unused.
     */
    parameters: t.UnknownRecord,
    /**
     * Contract addresses
     */
    addresses: t.type({
      create2Deployer: t.string,
      precompileCostEstimator: t.string,
      verificationGateway: t.string,
      blsLibrary: t.string,
      blsExpander: t.string,
      testToken: t.string,
      rewardToken: t.string,
    }),
    /**
     * Additional information about deployment/deployed state
     */
    auxiliary: t.type({
      chainid: t.number,
      /**
       * Domain used for BLS signing
       */
      domain: t.string,
      /**
       * Starting block contracts began dpeloyment at
       */
      genesisBlock: t.number,
      /**
       * Address of the EOA which deployed the contracts
       */
      deployedBy: t.string,
      /**
       * Git commit SHA of the contracts
       */
      version: t.string,
    }),
  }),
);

/**
 * Config representing the deployed state of bls-wallet contracts
 */
export type NetworkConfig = t.TypeOf<typeof NetworkConfigType>;

type ReadFileFunc = (filePath: string) => Promise<string>;

/**
 * Validates and returns a network config.
 *
 * @param cfg The config object to validate.
 */
export function validateConfig(cfg: unknown): NetworkConfig {
  const result = NetworkConfigType.decode(cfg);
  const report = PathReporter.report(result);
  const hasErrors = report.length > 0 && report[0] !== "No errors!";
  if (hasErrors) {
    throw new Error(report.join(", "));
  }
  return cfg as NetworkConfig;
}

/**
 * Retrieves, validates, and returns a network config.
 *
 * @param networkConfigPath Path to config JSON file.
 * @param readFileFunc Callback to retrieve the config. This could be via fetch, fs.readFile, etc.
 */
export async function getConfig(
  networkConfigPath: string,
  readFileFunc: ReadFileFunc,
): Promise<NetworkConfig> {
  const cfg = JSON.parse(await readFileFunc(networkConfigPath));
  validateConfig(cfg);
  return cfg;
}
