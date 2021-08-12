import {
  optionalEnv,
  requireBoolEnv,
  requireEnv,
} from "../src/helpers/envTools.ts";

export * from "../src/env.ts";

export const TEST_SEED = optionalEnv("TEST_SEED");
export const TEST_TOKEN_ADDRESS = requireEnv("TEST_TOKEN_ADDRESS");

export const TEST_LOGGING = requireBoolEnv("TEST_LOGGING");

export const TEST_BLS_WALLETS_SECRET = requireEnv("TEST_BLS_WALLETS_SECRET");
