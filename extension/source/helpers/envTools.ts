import assert from './assert';

export function requireEnv(value: string | undefined): string {
  assert(
    value !== undefined,
    () => new Error('Missing required environment variable'),
  );

  return value;
}

export function requireBoolEnv(strValue: string | undefined): boolean {
  assert(
    ['true', 'false'].includes(strValue ?? ''),
    () => new Error(`Failed to parse "${strValue}" as boolean`),
  );

  return strValue === 'true';
}

export function requireIntEnv(strValue: string | undefined): number {
  const value = Number(strValue);

  assert(
    value === Math.round(value),
    () => new Error(`Failed to parse "${strValue}" as int`),
  );

  return value;
}
