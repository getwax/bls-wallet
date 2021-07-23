import { optionalEnv, requireEnv } from "../src/helpers/envTools.ts";

export * from "../src/app/env.ts";

export const TEST_SEED = optionalEnv("TEST_SEED");
export const TEST_TOKEN_ADDRESS = requireEnv("TEST_TOKEN_ADDRESS");
