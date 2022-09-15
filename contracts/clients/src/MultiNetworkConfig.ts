import { NetworkConfig, validateConfig } from "./NetworkConfig";

/**
 * Config representing the deployed state of bls-wallet contracts
 * across multiple networks.
 */
export type MultiNetworkConfig = {
  [networkKey: string]: NetworkConfig;
};

/**
 * Unvalidated MultiNetworkConfig
 */
export type UnvalidatedMultiNetworkConfig = Record<
  string,
  Record<string, Record<string, unknown>>
>;

type ReadFileFunc = (filePath: string) => Promise<string>;

/**
 * Validates and returns a multi-network config.
 *
 * @param cfg The config object to validate.
 */
export function validateMultiConfig(
  cfg: MultiNetworkConfig,
): MultiNetworkConfig {
  const isEmpty = !Object.keys(cfg).length;
  if (isEmpty) {
    throw new Error("config is empty");
  }

  const multiConfig: MultiNetworkConfig = {};
  for (const [networkKey, networkConfig] of Object.entries(cfg)) {
    try {
      multiConfig[networkKey] = validateConfig(networkConfig);
    } catch (err) {
      const castErr = err as Error;
      const newErr = new Error(`${networkKey}: ${castErr.message}`);
      newErr.stack = castErr.stack;
      throw newErr;
    }
  }
  return multiConfig;
}

/**
 * Retrieves, validates, and returns a multi-network config.
 *
 * @param networkConfigPath Path to config JSON file.
 * @param readFileFunc Callback to retrieve the config. This could be via fetch, fs.readFile, etc.
 */
export async function getMultiConfig(
  configPath: string,
  readFileFunc: ReadFileFunc,
): Promise<NetworkConfig> {
  const cfg = JSON.parse(await readFileFunc(configPath));
  validateMultiConfig(cfg);
  return cfg;
}
