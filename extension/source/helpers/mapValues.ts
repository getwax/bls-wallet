import recordKeys from './recordKeys';

export default function mapValues<
  InputRecord extends Record<string, unknown>,
  Response,
>(
  inputs: InputRecord,
  mapper: (
    input: InputRecord[keyof InputRecord],
    key: keyof InputRecord,
  ) => Response,
): Record<keyof InputRecord, Response> {
  const res = {} as Record<keyof InputRecord, Response>;

  for (const key of recordKeys(inputs)) {
    res[key] = mapper(inputs[key], key);
  }

  return res;
}
