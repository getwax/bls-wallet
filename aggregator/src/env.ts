import {
  requireBigNumberEnv,
  requireBoolEnv,
  requireEnv,
  requireIntEnv,
} from "./helpers/envTools.ts";

export const RPC_URL = requireEnv("RPC_URL");

export const ORIGIN = requireEnv("ORIGIN");
export const PORT = requireIntEnv("PORT");

export const USE_TEST_NET = requireBoolEnv("USE_TEST_NET");

export const NETWORK_CONFIG_PATH = requireEnv("NETWORK_CONFIG_PATH");
export const PRIVATE_KEY_AGG = requireEnv("PRIVATE_KEY_AGG");
export const PRIVATE_KEY_ADMIN = requireEnv("PRIVATE_KEY_ADMIN");

export const PG = {
  HOST: requireEnv("PG_HOST"),
  PORT: requireEnv("PG_PORT"),
  USER: requireEnv("PG_USER"),
  PASSWORD: requireEnv("PG_PASSWORD"),
  DB_NAME: requireEnv("PG_DB_NAME"),
};

export const BUNDLE_TABLE_NAME = requireEnv("BUNDLE_TABLE_NAME");

/**
 * Query limit used when processing potentially large numbers of bundles.
 * (Using batching if needed.)
 */
export const BUNDLE_QUERY_LIMIT = requireIntEnv("BUNDLE_QUERY_LIMIT");
/**
 * Maximum retry delay in blocks before a failed bundle is discarded.
 */
export const MAX_ELIGIBILITY_DELAY = requireIntEnv("MAX_ELIGIBILITY_DELAY");

export const MAX_AGGREGATION_SIZE = requireIntEnv("MAX_AGGREGATION_SIZE");

export const MAX_AGGREGATION_DELAY_MILLIS = requireIntEnv(
  "MAX_AGGREGATION_DELAY_MILLIS",
);

export const MAX_UNCONFIRMED_AGGREGATIONS = requireIntEnv(
  "MAX_UNCONFIRMED_AGGREGATIONS",
);

export const LOG_QUERIES = requireBoolEnv("LOG_QUERIES");

export const FEE_TYPE = requireEnv("FEE_TYPE");
export const FEE_PER_GAS = requireBigNumberEnv("FEE_PER_GAS");
export const FEE_PER_BYTE = requireBigNumberEnv("FEE_PER_BYTE");

if (!/^(ether|token:0x[0-9a-fA-F]*)$/.test(FEE_TYPE)) {
  throw new Error(`FEE_TYPE has invalid format: "${FEE_TYPE}"`);
}
