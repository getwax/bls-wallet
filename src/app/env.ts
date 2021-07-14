import {
  requireBoolEnv,
  requireEnv,
  requireIntEnv,
} from "../helpers/envTools.ts";

export const PORT = requireIntEnv("PORT");

export const USE_TEST_NET = requireBoolEnv("USE_TEST_NET");

export const PRIVATE_KEY_AGG = requireEnv("PRIVATE_KEY_AGG");

export const DEPLOYER_ADDRESS = requireEnv("DEPLOYER_ADDRESS");

export const VERIFICATION_GATEWAY_ADDRESS = requireEnv(
  "VERIFICATION_GATEWAY_ADDRESS",
);

export const BLS_EXPANDER_ADDRESS = requireEnv("BLS_EXPANDER_ADDRESS");

export const TOKEN_ADDRESS = requireEnv("TOKEN_ADDRESS");
export const REWARD_TOKEN_ADDRESS = requireEnv("REWARD_TOKEN_ADDRESS");

export const PG = {
  HOST: requireEnv("PG_HOST"),
  PORT: requireEnv("PG_PORT"),
  USER: requireEnv("PG_USER"),
  PASSWORD: requireEnv("PG_PASSWORD"),
  DB_NAME: requireEnv("PG_DB_NAME"),
};

export const TX_TABLE_NAME = requireEnv("TX_TABLE_NAME");
export const FUTURE_TX_TABLE_NAME = requireEnv("FUTURE_TX_TABLE_NAME");

/**
 * Query size used when moving txs from the future table into the ready table.
 */
export const FUTURE_BATCH_SIZE = requireIntEnv("FUTURE_BATCH_SIZE");

export const MAX_FUTURE_TXS = requireIntEnv("MAX_FUTURE_TXS");

export const LOG_QUERIES = requireBoolEnv("LOG_QUERIES");
