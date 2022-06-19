// TODO: Remove

export function requireEnv(value: string | undefined): string {
  if (value === undefined) {
    throw new Error('Missing required environment variable');
  }

  return value;
}

export function requireBoolEnv(strValue: string | undefined): boolean {
  if (!['true', 'false'].includes(strValue ?? '')) {
    throw new Error(`Failed to parse "${strValue}" as boolean`);
  }

  return strValue === 'true';
}

export function requireIntEnv(strValue: string | undefined): number {
  const value = Number(strValue);

  if (value !== Math.round(value)) {
    throw new Error(`Failed to parse "${strValue}" as int`);
  }

  return value;
}
