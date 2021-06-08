import { optionalEnv } from "../src/helpers/envTools.ts";

export * from "../src/app/env.ts";

export const TEST_SEED = optionalEnv("TEST_SEED");
