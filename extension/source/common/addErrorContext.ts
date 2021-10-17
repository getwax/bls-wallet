export default function addErrorContext<Params extends unknown[], Result>(
  context: string,
  fn: (...params: Params) => Result,
): typeof fn {
  return (...params) => {
    try {
      let result = fn(...params);

      if (isPromise(result)) {
        result = result.catch((e) =>
          rethrowWithContext(context, e),
        ) as unknown as Result;
      }

      return result;
    } catch (error) {
      rethrowWithContext(context, error);
    }
  };
}

function isPromise(value: unknown): value is Promise<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).then === 'function'
  );
}

function rethrowWithContext(context: string, error: unknown): never {
  if (error instanceof Error) {
    error.message = `${context}: ${error.message}`;
    throw error;
  }

  throw new Error(`${context}: non-error rethrown: ${error}`);
}
