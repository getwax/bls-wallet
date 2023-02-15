/**
 * Config representing the deployed state of bls-wallet contracts
 */
export type NetworkConfig = {
  /**
   * Parameters used in contract deployment. Currently unused.
   */
  parameters: Record<string, unknown>;
  /**
   * Contract addresses
   */
  addresses: {
    safeSingletonFactory: string;
    precompileCostEstimator: string;
    verificationGateway: string;
    blsExpander: string;
    utilities: string;
    testToken: string;
  };
  /**
   * Additional information about deployment/deployed state
   */
  auxiliary: {
    chainid: number;
    /**
     * Domain used for BLS signing
     */
    domain: string;
    /**
     * Starting block contracts began dpeloyment at
     */
    genesisBlock: number;
    /**
     * Address of the EOA which deployed the contracts
     */
    deployedBy: string;
    /**
     * Git commit SHA of the contracts
     */
    version: string;
  };
};

type ReadFileFunc = (filePath: string) => Promise<string>;
type UnvalidatedConfig = Record<string, Record<string, unknown>>;

/**
 * Validates and returns a network config.
 *
 * @param cfg The config object to validate.
 */
export function validateConfig(cfg: UnvalidatedConfig): NetworkConfig {
  return {
    parameters: assertUnknownRecord(cfg.parameters),
    addresses: {
      safeSingletonFactory: assertString(cfg.addresses.safeSingletonFactory),
      precompileCostEstimator: assertString(
        cfg.addresses.precompileCostEstimator,
      ),
      verificationGateway: assertString(cfg.addresses.verificationGateway),
      blsExpander: assertString(cfg.addresses.blsExpander),
      utilities: assertString(cfg.addresses.utilities),
      testToken: assertString(cfg.addresses.testToken),
    },
    auxiliary: {
      chainid: assertNumber(cfg.auxiliary.chainid),
      domain: assertString(cfg.auxiliary.domain),
      genesisBlock: assertNumber(cfg.auxiliary.genesisBlock),
      deployedBy: assertString(cfg.auxiliary.deployedBy),
      version: assertString(cfg.auxiliary.version),
    },
  };
}

/**
 * Retrieves, validates, and returns a network config.
 * @deprecated Use getMultiConfig instead.
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

function assertUnknownRecord(value: unknown): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Object.keys(value).some((k) => typeof k !== "string")
  ) {
    throw new Error("Unknown record required");
  }

  return value as Record<string, unknown>;
}

function assertNumber(value: unknown): number {
  if (typeof value !== "number") {
    throw new Error("Number required");
  }

  return value;
}

function assertString(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("String required");
  }

  return value;
}
