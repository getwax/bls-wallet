import recordKeys from './recordKeys';

export default function mapValues<
  InputRecord extends Record<string, unknown>,
  Output,
>(
  inputs: InputRecord,
  mapper: (
    input: InputRecord[keyof InputRecord],
    key: keyof InputRecord,
  ) => Output,
): Record<keyof InputRecord, Output> {
  const res = {} as Record<keyof InputRecord, Output>;

  for (const key of recordKeys(inputs)) {
    res[key] = mapper(inputs[key], key);
  }

  return res;
}
