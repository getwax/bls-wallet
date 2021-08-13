import { dotEnvConfig, exists, parseArgs } from "../../deps/index.ts";
import nil from "./nil.ts";

const args = parseArgs(Deno.args);

const envName = args.env;
const envFile = envName ? `.env.${envName}` : ".env";

if (!await exists(envFile)) {
  console.log("Couldn't find env file", envFile);
  console.log("(See #configuration in README.md)");

  Deno.exit(1);
}

const dotEnv = dotEnvConfig({ path: envFile });

export function optionalEnv(envName: string): string | nil {
  return dotEnv[envName] ?? Deno.env.get(envName);
}

export function requireEnv(envName: string): string {
  const value = optionalEnv(envName);

  if (value === nil) {
    throw new Error(`Missing required environment variable ${envName}`);
  }

  return value;
}

export function requireBoolEnv(envName: string): boolean {
  const strValue = requireEnv(envName);

  if (!["true", "false"].includes(strValue)) {
    throw new Error(`Failed to parse ${envName} as boolean: ${strValue}`);
  }

  return strValue === "true";
}

export function requireIntEnv(envName: string): number {
  const strValue = requireEnv(envName);
  const value = Number(strValue);

  if (value !== Math.round(value)) {
    throw new Error(`Failed to parse ${envName} as int: ${strValue}`);
  }

  return value;
}
