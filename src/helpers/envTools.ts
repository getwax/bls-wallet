import { dotEnvConfig } from "../../deps/index.ts";

const dotEnv = dotEnvConfig();

export function optionalEnv(envName: string): string | null {
  return dotEnv[envName] ?? Deno.env.get(envName) ?? null;
}

export function requireEnv(envName: string): string {
  const value = optionalEnv(envName);

  if (value === null) {
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
