import addErrorContext from './addErrorContext';

export default function validateOptionalStringRecord<
  Keys extends readonly string[],
>(keys: Keys): (value: unknown) => { [K in Keys[number]]?: string } {
  return addErrorContext('validateOptionalStringRecord', (value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('Expected object');
    }

    const valueRecord = value as Record<string, unknown>;

    const result: { [K in Keys[number]]?: string } = {};

    for (const k of keys) {
      const fieldValue = valueRecord[k];

      if (fieldValue === undefined) {
        continue;
      }

      if (typeof fieldValue !== 'string') {
        throw new Error(
          `Expected field "${k}" to be a string (but was: ${typeof fieldValue})`,
        );
      }

      result[k as Keys[number]] = fieldValue;
    }

    return result;
  });
}
