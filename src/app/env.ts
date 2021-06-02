import { dotEnvConfig } from "../../deps/index.ts";

dotEnvConfig({ export: true });

function requireEnv(envName: string): string {
  const value = Deno.env.get(envName);

  if (value === undefined) {
    throw new Error(`Missing required environment variable ${envName}`);
  }

  return value;
}

function requireBoolEnv(envName: string): boolean {
  const strValue = requireEnv(envName);

  if (!["true", "false"].includes(strValue)) {
    throw new Error(`Failed to parse ${envName} as boolean: ${strValue}`);
  }

  return strValue === "true";
}

export const USE_TEST_NET = requireBoolEnv("USE_TEST_NET");

export const PRIVATE_KEY_AGG = requireEnv("PRIVATE_KEY_AGG");

export const DEPLOYER_ADDRESS = requireEnv("DEPLOYER_ADDRESS");

export const VERIFICATION_GATEWAY_ADDRESS = requireEnv(
  "VERIFICATION_GATEWAY_ADDRESS",
);

export const BLS_EXPANDER_ADDRESS = requireEnv("BLS_EXPANDER_ADDRESS");

export const TOKEN_ADDRESS = requireEnv("TOKEN_ADDRESS");
