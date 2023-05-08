import assert from "./helpers/assert.ts";
import {
  optionalNumberEnv,
  requireBigNumberEnv,
  requireBoolEnv,
  requireEnv,
  requireIntEnv,
  requireNumberEnv,
} from "./helpers/envTools.ts";
import nil from "./helpers/nil.ts";

export const RPC_URL = requireEnv("RPC_URL");
export const RPC_POLLING_INTERVAL = requireIntEnv("RPC_POLLING_INTERVAL");

export const ORIGIN = requireEnv("ORIGIN");
export const PORT = requireIntEnv("PORT");

export const USE_TEST_NET = requireBoolEnv("USE_TEST_NET");

export const NETWORK_CONFIG_PATH = Deno.env.get("IS_DOCKER") === "true"
  ? "/app/networkConfig.json"
  : requireEnv("NETWORK_CONFIG_PATH");

export const PRIVATE_KEY_AGG = requireEnv("PRIVATE_KEY_AGG");
export const PRIVATE_KEY_ADMIN = requireEnv("PRIVATE_KEY_ADMIN");

export const DB_PATH = requireEnv("DB_PATH");

/**
 * Query limit used when processing potentially large numbers of bundles.
 * (Using batching if needed.)
 */
export const BUNDLE_QUERY_LIMIT = requireIntEnv("BUNDLE_QUERY_LIMIT");

/**
 * Maximum retry delay in blocks before a failed bundle is discarded.
 */
export const MAX_ELIGIBILITY_DELAY = requireIntEnv("MAX_ELIGIBILITY_DELAY");

/**
 * Approximate maximum gas of aggregate bundles.
 *
 * It's approximate because we use the sum of the marginal gas estimates and add
 * the bundle overhead, which is not exactly the same as the gas used when
 * putting the bundle together.
 */
export const MAX_GAS_PER_BUNDLE = requireIntEnv("MAX_GAS_PER_BUNDLE");

export const MAX_AGGREGATION_DELAY_MILLIS = requireIntEnv(
  "MAX_AGGREGATION_DELAY_MILLIS",
);

export const MAX_UNCONFIRMED_AGGREGATIONS = requireIntEnv(
  "MAX_UNCONFIRMED_AGGREGATIONS",
);

export const LOG_QUERIES = requireBoolEnv("LOG_QUERIES");

export const REQUIRE_FEES = requireBoolEnv("REQUIRE_FEES");

export const BREAKEVEN_OPERATION_COUNT = requireNumberEnv(
  "BREAKEVEN_OPERATION_COUNT",
);

export const ALLOW_LOSSES = requireBoolEnv("ALLOW_LOSSES");

export const FEE_TYPE = requireEnv("FEE_TYPE");

if (!/^(ether|token:0x[0-9a-fA-F]*)$/.test(FEE_TYPE)) {
  throw new Error(`FEE_TYPE has invalid format: "${FEE_TYPE}"`);
}

export const ETH_VALUE_IN_TOKENS = optionalNumberEnv("ETH_VALUE_IN_TOKENS");

if (FEE_TYPE.startsWith("token:") && ETH_VALUE_IN_TOKENS === nil) {
  throw new Error([
    "Missing ETH_VALUE_IN_TOKENS, which is required because FEE_TYPE is a",
    "token",
  ].join(" "));
}

export const AUTO_CREATE_INTERNAL_BLS_WALLET = requireBoolEnv(
  "AUTO_CREATE_INTERNAL_BLS_WALLET",
);

export const PRIORITY_FEE_PER_GAS = requireBigNumberEnv("PRIORITY_FEE_PER_GAS");

/**
 * Used to determine the expected basefee when submitting bundles. Note that
 * this gets passed onto users.
 */
export const PREVIOUS_BASE_FEE_PERCENT_INCREASE = requireNumberEnv(
  "PREVIOUS_BASE_FEE_PERCENT_INCREASE",
);

export const BUNDLE_CHECKING_CONCURRENCY = requireIntEnv(
  "BUNDLE_CHECKING_CONCURRENCY",
);

/**
 * Optimism's strategy for charging for L1 fees requires special logic in the
 * aggregator. In addition to gasEstimate * gasPrice, we need to replicate
 * Optimism's calculation and pass it on to the user.
 */
export const IS_OPTIMISM = requireBoolEnv("IS_OPTIMISM");

/**
 * Similar to PREVIOUS_BASE_FEE_PERCENT_INCREASE, but for the L1 basefee for
 * the optimism-specific calculation. This gets passed on to users.
 */
export const OPTIMISM_L1_BASE_FEE_PERCENT_INCREASE = optionalNumberEnv(
  "OPTIMISM_L1_BASE_FEE_PERCENT_INCREASE",
);

if (IS_OPTIMISM) {
  assert(
    OPTIMISM_L1_BASE_FEE_PERCENT_INCREASE !== nil,
    "OPTIMISM_L1_BASE_FEE_PERCENT_INCREASE is required when IS_OPTIMISM is true",
  );
}
