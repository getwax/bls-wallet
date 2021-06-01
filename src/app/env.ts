import { dotEnvConfig } from "../../deps/index.ts";

dotEnvConfig({ export: true });

function requireEnv(envName: string): string {
  const value = Deno.env.get(envName);

  if (value === undefined) {
    throw new Error(`Missing required environment variable ${envName}`);
  }

  return value;
}

export const PRIVATE_KEY_AGG = requireEnv("PRIVATE_KEY_AGG");
export const DEPLOYER_ADDRESS = requireEnv("DEPLOYER_ADDRESS");
export const TOKEN_ADDRESS = requireEnv("TOKEN_ADDRESS");
