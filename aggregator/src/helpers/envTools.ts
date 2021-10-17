import { dotEnvConfig } from "../../deps.ts";

import dotEnvPath from "./dotEnvPath.ts";
import nil from "./nil.ts";

const dotEnv = dotEnvConfig({ path: dotEnvPath });

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
